// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, euint64, einput, ebool} from "fhevm/lib/TFHE.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IToken} from "../../token/IToken.sol";
import {IModularCompliance} from "./IModularCompliance.sol";
import {MCStorage} from "./MCStorage.sol";
import {IModule} from "./modules/IModule.sol";
import "hardhat/console.sol";

contract ModularCompliance is IModularCompliance, OwnableUpgradeable, MCStorage {
    /// modifiers

    /**
     * @dev Throws if called by any address that is not a token bound to the compliance.
     */
    modifier onlyToken() {
        require(msg.sender == _tokenBound, "error : this address is not a token bound to the compliance contract");
        _;
    }

    function init() external initializer {
        __Ownable_init(msg.sender);
    }

    /**
     *  @dev See {IModularCompliance-bindToken}.
     */
    function bindToken(address _token) external override {
        require(
            owner() == msg.sender || (_tokenBound == address(0) && msg.sender == _token),
            "only owner or token can call"
        );
        require(_token != address(0), "invalid argument - zero address");
        _tokenBound = _token;
        emit TokenBound(_token);
    }

    /**
     *  @dev See {IModularCompliance-unbindToken}.
     */
    function unbindToken(address _token) external override {
        require(owner() == msg.sender || msg.sender == _token, "only owner or token can call");
        require(_token == _tokenBound, "This token is not bound");
        require(_token != address(0), "invalid argument - zero address");
        delete _tokenBound;
        emit TokenUnbound(_token);
    }

    /**
     *  @dev See {IModularCompliance-addModule}.
     */
    function addModule(address _module) external override onlyOwner {
        require(_module != address(0), "invalid argument - zero address");
        require(!_moduleBound[_module], "module already bound");
        require(_modules.length <= 24, "cannot add more than 25 modules");
        IModule module = IModule(_module);
        if (!module.isPlugAndPlay()) {
            require(module.canComplianceBind(address(this)), "compliance is not suitable for binding to the module");
        }

        module.bindCompliance(address(this));
        _modules.push(_module);
        _moduleBound[_module] = true;
        emit ModuleAdded(_module);
    }

    /**
     *  @dev See {IModularCompliance-removeModule}.
     */
    function removeModule(address _module) external override onlyOwner {
        require(_module != address(0), "invalid argument - zero address");
        require(_moduleBound[_module], "module not bound");
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; i++) {
            if (_modules[i] == _module) {
                IModule(_module).unbindCompliance(address(this));
                _modules[i] = _modules[length - 1];
                _modules.pop();
                _moduleBound[_module] = false;
                emit ModuleRemoved(_module);
                break;
            }
        }
    }

    /**
     *  @dev See {IModularCompliance-transferred}.
     */
    function transferred(
        address _from,
        address _to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public override onlyToken {
        transferred(_from, _to, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @dev See {IModularCompliance-transferred}.
     */
    function transferred(address _from, address _to, euint64 _evalue) public override onlyToken {
        require(_from != address(0) && _to != address(0), "invalid argument - zero address");
        require(TFHE.isSenderAllowed(_evalue));
        // require(_value > 0, "invalid argument - no value transfer");
        ebool ehasValue = TFHE.gt(_evalue, TFHE.asEuint64(0));
        euint64 evalue = TFHE.select(ehasValue, _evalue, TFHE.asEuint64(0));
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; i++) {
            IModule(_modules[i]).moduleTransferAction(_from, _to, evalue);
        }
    }

    /**
     *  @dev See {IModularCompliance-created}.
     */
    function created(address _to, einput encryptedAmount, bytes calldata inputProof) public override onlyToken {
        created(_to, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @dev See {IModularCompliance-created}.
     */
    function created(address _to, euint64 _evalue) public override onlyToken {
        require(_to != address(0), "invalid argument - zero address");
        require(TFHE.isSenderAllowed(_evalue));
        //require(_evalue > 0, "invalid argument - no value mint");
        ebool ehasValue = TFHE.gt(_evalue, TFHE.asEuint64(0));
        euint64 evalue = TFHE.select(ehasValue, _evalue, TFHE.asEuint64(0));
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; i++) {
            IModule(_modules[i]).moduleMintAction(_to, evalue);
        }
    }

    /**
     *  @dev See {IModularCompliance-destroyed}.
     */
    function destroyed(address _from, einput encryptedAmount, bytes calldata inputProof) public override onlyToken {
        destroyed(_from, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @dev See {IModularCompliance-destroyed}.
     */
    function destroyed(address _from, euint64 _evalue) public override onlyToken {
        require(_from != address(0), "invalid argument - zero address");
        require(TFHE.isSenderAllowed(_evalue));
        //require(_evalue > 0, "invalid argument - no value burn");
        ebool ehasValue = TFHE.gt(_evalue, TFHE.asEuint64(0));
        euint64 evalue = TFHE.select(ehasValue, _evalue, TFHE.asEuint64(0));
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; i++) {
            IModule(_modules[i]).moduleBurnAction(_from, evalue);
        }
    }

    /**
     *  @dev see {IModularCompliance-callModuleFunction}.
     */
    function callModuleFunction(bytes calldata callData, address _module) external override onlyOwner {
        require(_moduleBound[_module], "call only on bound module");
        // NOTE: Use assembly to call the interaction instead of a low level
        // call for two reasons:
        // - We don't want to copy the return data, since we discard it for
        // interactions.
        // - Solidity will under certain conditions generate code to copy input
        // calldata twice to memory (the second being a "memcopy loop").
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let freeMemoryPointer := mload(0x40)
            calldatacopy(freeMemoryPointer, callData.offset, callData.length)
            if iszero(call(gas(), _module, 0, freeMemoryPointer, callData.length, 0, 0)) {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }

        emit ModuleInteraction(_module, _selector(callData));
    }

    /**
     *  @dev See {IModularCompliance-isModuleBound}.
     */
    function isModuleBound(address _module) external view override returns (bool) {
        return _moduleBound[_module];
    }

    /**
     *  @dev See {IModularCompliance-getModules}.
     */
    function getModules() external view override returns (address[] memory) {
        return _modules;
    }

    /**
     *  @dev See {IModularCompliance-getTokenBound}.
     */
    function getTokenBound() external view override returns (address) {
        return _tokenBound;
    }

    /**
     *  @dev See {IModularCompliance-canTransfer}.
     */
    function canTransfer(address _from, address _to, euint64 _evalue) external override returns (ebool) {
        uint256 length = _modules.length;
        ebool ecanTransfer = TFHE.asEbool(true);
        for (uint256 i = 0; i < length; i++) {
            ebool echeck = IModule(_modules[i]).moduleCheck(_from, _to, _evalue, address(this));
            ecanTransfer = TFHE.and(ecanTransfer, echeck);
            // if (!IModule(_modules[i]).moduleCheck(_from, _to, _value, address(this))) {
            //     return false;
            // }
        }
        //return true;

        TFHE.allowTransient(ecanTransfer, msg.sender);
        return ecanTransfer;
    }

    /// @dev Extracts the Solidity ABI selector for the specified interaction.
    /// @param callData Interaction data.
    /// @return result The 4 byte function selector of the call encoded in
    /// this interaction.
    function _selector(bytes calldata callData) internal pure returns (bytes4 result) {
        if (callData.length >= 4) {
            // NOTE: Read the first word of the interaction's calldata. The
            // value does not need to be shifted since `bytesN` values are left
            // aligned, and the value does not need to be masked since masking
            // occurs when the value is accessed and not stored:
            // <https://docs.soliditylang.org/en/v0.7.6/abi-spec.html#encoding-of-indexed-event-parameters>
            // <https://docs.soliditylang.org/en/v0.7.6/assembly.html#access-to-external-variables-functions-and-libraries>
            // solhint-disable-next-line no-inline-assembly
            assembly {
                result := calldataload(callData.offset)
            }
        }
    }
}

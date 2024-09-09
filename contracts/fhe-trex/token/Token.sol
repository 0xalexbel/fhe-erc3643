// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {TFHE, euint64, einput, ebool} from "fhevm/lib/TFHE.sol";
import {IToken} from "./IToken.sol";
import {IIdentity} from "../../identity/interfaces/IIdentity.sol";
import {IIdentityRegistry} from "../registry/interfaces/IIdentityRegistry.sol";
import {IModularCompliance} from "../compliance/modular/IModularCompliance.sol";
import {TokenStorage} from "./TokenStorage.sol";
import {AgentRoleUpgradeable} from "../roles/AgentRoleUpgradeable.sol";

contract Token is IToken, AgentRoleUpgradeable, TokenStorage {
    /// modifiers

    /// @dev Modifier to make a function callable only when the contract is not paused.
    modifier whenNotPaused() {
        require(!_tokenPaused, "Pausable: paused");
        _;
    }

    /// @dev Modifier to make a function callable only when the contract is paused.
    modifier whenPaused() {
        require(_tokenPaused, "Pausable: not paused");
        _;
    }

    /**
     *  @dev the constructor initiates the token contract
     *  msg.sender is set automatically as the owner of the smart contract
     *  @param _identityRegistry the address of the Identity registry linked to the token
     *  @param _compliance the address of the compliance contract linked to the token
     *  @param _name the name of the token
     *  @param _symbol the symbol of the token
     *  @param _decimals the decimals of the token
     *  @param _onchainID the address of the onchainID of the token
     *  emits an `UpdatedTokenInformation` event
     *  emits an `IdentityRegistryAdded` event
     *  emits a `ComplianceAdded` event
     */
    function init(
        address _identityRegistry,
        address _compliance,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        // _onchainID can be zero address if not set, can be set later by owner
        address _onchainID
    ) external initializer {
        // that require is protecting legacy versions of TokenProxy contracts
        // as there was a bug with the initializer modifier on these proxies
        // that check is preventing attackers to call the init functions on those
        // legacy contracts.
        require(owner() == address(0), "already initialized");
        require(_identityRegistry != address(0) && _compliance != address(0), "invalid argument - zero address");
        require(
            keccak256(abi.encode(_name)) != keccak256(abi.encode("")) &&
                keccak256(abi.encode(_symbol)) != keccak256(abi.encode("")),
            "invalid argument - empty string"
        );
        require(0 <= _decimals && _decimals <= 18, "decimals between 0 and 18");
        __Ownable_init(msg.sender);
        _tokenName = _name;
        _tokenSymbol = _symbol;
        _tokenDecimals = _decimals;
        _tokenOnchainID = _onchainID;
        _tokenPaused = true;
        _totalSupply = TFHE.asEuint64(0);
        setIdentityRegistry(_identityRegistry);
        setCompliance(_compliance);
        emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenDecimals, _TOKEN_VERSION, _tokenOnchainID);
    }

    /**
     *  @dev See {IERC20-approve}.
     */
    function approve(
        address _spender,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external virtual override returns (bool) {
        // TFHE.allowedTransient(TFHE.asEuint64(encryptedAmount, inputProof), msg.sender) == true
        return approve(_spender, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @dev See {IERC20-approve}.
     */
    function approve(address _spender, euint64 _eamount) public virtual override returns (bool) {
        require(
            TFHE.isSenderAllowed(_eamount),
            "TFHE: caller does not have TFHE permissions to access amount argument"
        );
        _approve(msg.sender, _spender, _eamount);
        return true;
    }

    /**
     *  @dev See {IERC20-increaseAllowance}.
     */
    function increaseAllowance(
        address _spender,
        einput encryptedAddedValue,
        bytes calldata inputProof
    ) external virtual returns (bool) {
        // TFHE.allowedTransient(TFHE.asEuint64(encryptedAddedValue, inputProof), msg.sender) == true
        return increaseAllowance(_spender, TFHE.asEuint64(encryptedAddedValue, inputProof));
    }

    /**
     *  @dev See {ERC20-increaseAllowance}.
     */
    function increaseAllowance(address _spender, euint64 _eaddedValue) public virtual returns (bool) {
        /*
            _approve(msg.sender, _spender, _allowances[msg.sender][_spender] + (_addedValue));
        */
        require(euint64.unwrap(_eaddedValue) != 0, "TFHE: addedValue argument cannot be uninitialized");
        require(
            TFHE.isSenderAllowed(_eaddedValue),
            "TFHE: caller does not have TFHE permissions to access addedValue argument"
        );

        euint64 senderSpenderAllowance = _getOrZero(_allowances[msg.sender][_spender]);

        // Debug
        require(
            TFHE.isAllowed(senderSpenderAllowance, address(this)),
            "TFHE: token does not have TFHE permissions to access allowance"
        );

        // _allowances[msg.sender][_spender] can be 0 or euint64
        euint64 eaddedValue = TFHE.add(senderSpenderAllowance, _eaddedValue);

        _approve(msg.sender, _spender, eaddedValue);

        return true;
    }

    /**
     *  @dev See {ERC20-decreaseAllowance}.
     */
    function decreaseAllowance(
        address _spender,
        einput encryptedSubstractedValue,
        bytes calldata inputProof
    ) external virtual returns (bool) {
        // TFHE.allowedTransient(TFHE.asEuint64(encryptedSubstractedValue, inputProof), msg.sender) == true
        return decreaseAllowance(_spender, TFHE.asEuint64(encryptedSubstractedValue, inputProof));
    }

    /**
     *  @dev See {ERC20-decreaseAllowance}.
     */
    function decreaseAllowance(address _spender, euint64 _esubtractedValue) public virtual returns (bool) {
        /*
            _approve(msg.sender, _spender, _allowances[msg.sender][_spender] - _subtractedValue);
        */
        require(euint64.unwrap(_esubtractedValue) != 0, "TFHE: subtractedValue argument cannot be uninitialized");
        require(
            TFHE.isSenderAllowed(_esubtractedValue),
            "TFHE: caller does not have TFHE permissions to access subtractedValue argument"
        );

        euint64 senderSpenderAllowance = _getOrZero(_allowances[msg.sender][_spender]);

        // Debug
        require(
            TFHE.isAllowed(senderSpenderAllowance, address(this)),
            "TFHE: token does not have TFHE permissions to access allowance"
        );

        // returns 0 if lhs < rhs
        euint64 esubstractedValue = _clampedSub(senderSpenderAllowance, _esubtractedValue);
        _approve(msg.sender, _spender, esubstractedValue);

        return true;
    }

    /**
     *  @dev See {IToken-setName}.
     */
    function setName(string calldata _name) external override onlyOwner {
        require(keccak256(abi.encode(_name)) != keccak256(abi.encode("")), "invalid argument - empty string");
        _tokenName = _name;
        emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenDecimals, _TOKEN_VERSION, _tokenOnchainID);
    }

    /**
     *  @dev See {IToken-setSymbol}.
     */
    function setSymbol(string calldata _symbol) external override onlyOwner {
        require(keccak256(abi.encode(_symbol)) != keccak256(abi.encode("")), "invalid argument - empty string");
        _tokenSymbol = _symbol;
        emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenDecimals, _TOKEN_VERSION, _tokenOnchainID);
    }

    /**
     *  @dev See {IToken-setOnchainID}.
     *  if _onchainID is set at zero address it means no ONCHAINID is bound to this token
     */
    function setOnchainID(address _onchainID) external override onlyOwner {
        _tokenOnchainID = _onchainID;
        emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenDecimals, _TOKEN_VERSION, _tokenOnchainID);
    }

    /**
     *  @dev See {IToken-pause}.
     */
    function pause() external override onlyAgent whenNotPaused {
        _tokenPaused = true;
        emit Paused(msg.sender);
    }

    /**
     *  @dev See {IToken-unpause}.
     */
    function unpause() external override onlyAgent whenPaused {
        _tokenPaused = false;
        emit Unpaused(msg.sender);
    }

    /**
     *  @dev See {IToken-batchTransfer}.
     */
    function batchTransfer(
        address[] calldata _toList,
        einput[] calldata encryptedAmounts,
        bytes calldata inputProof
    ) public override {
        for (uint256 i = 0; i < _toList.length; i++) {
            transfer(_toList[i], TFHE.asEuint64(encryptedAmounts[i], inputProof));
        }
    }

    /**
     *  @dev See {IToken-batchTransfer}.
     */
    function batchTransfer(address[] calldata _toList, euint64[] calldata _eamounts) public override {
        for (uint256 i = 0; i < _toList.length; i++) {
            transfer(_toList[i], _eamounts[i]);
        }
    }

    /**
     *  @dev See {IToken-transferFrom}.
     */
    function transferFrom(
        address _from,
        address _to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public override whenNotPaused returns (bool) {
        // TFHE.allowedTransient(TFHE.asEuint64(encryptedAmount, inputProof), msg.sender) == true
        return transferFrom(_from, _to, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @notice ERC-20 overridden function that include logic to check for trade validity.
     *  Require that the from and to addresses are not frozen.
     *  Require that the value should not exceed available balance .
     *  Require that the to address is a verified address
     *  @param _from The address of the sender
     *  @param _to The address of the receiver
     *  @param _eamount The number of tokens to transfer
     *  @return `true` if successful and revert if unsuccessful
     */
    function transferFrom(address _from, address _to, euint64 _eamount) public override whenNotPaused returns (bool) {
        require(!_frozen[_to] && !_frozen[_from], "wallet is frozen");
        require(
            TFHE.isSenderAllowed(_eamount),
            "TFHE: caller does not have TFHE permissions to access amount argument"
        );

        euint64 fromFrozenTokens = _getOrZero(_frozenTokens[_from]);
        euint64 fromBalance = _getOrZero(balanceOf(_from));
        euint64 fromSenderAllowance = _getOrZero(_allowances[_from][msg.sender]);

        // Debug
        require(
            TFHE.isAllowed(fromFrozenTokens, address(this)),
            "TFHE: token does not have TFHE permissions to access frozen token"
        );
        // Debug
        require(
            TFHE.isAllowed(fromBalance, address(this)),
            "TFHE: token does not have TFHE permissions to access balance"
        );
        // Debug
        require(
            TFHE.isAllowed(fromSenderAllowance, address(this)),
            "TFHE: token does not have TFHE permissions to access allowances"
        );

        // 'balanceOf(_from)' is always greater than '_frozenTokens[_from]'
        // if _eamount <= balanceOf(_from) - _frozenTokens[_from]
        // then eamount = _eamount
        // otherwise eamount = 0
        euint64 eamount = _selectLeSub(_eamount, fromBalance, fromFrozenTokens);

        if (_tokenIdentityRegistry.isVerified(_to)) {
            // give _tokenCompliance TFHE access for:
            // - canTransfer(...)
            // - transferred(...)
            TFHE.allowTransient(eamount, address(_tokenCompliance));

            ebool ecanTransfer = _tokenCompliance.canTransfer(_from, _to, eamount);

            // if canTransfer failed, set the amount to 0
            eamount = TFHE.select(ecanTransfer, eamount, TFHE.asEuint64(0));

            //_approve(_from, msg.sender, _allowances[_from][msg.sender] - (_amount))
            _approve(_from, msg.sender, _clampedSub(fromSenderAllowance, eamount));

            // give _tokenCompliance TFHE access for:
            // - canTransfer(...)
            // - transferred(...)
            TFHE.allowTransient(eamount, address(_tokenCompliance));

            //_transfer(_from, _to, _amount);
            _transfer(_from, _to, eamount);

            //_tokenCompliance.transferred(_from, _to, _amount);
            _tokenCompliance.transferred(_from, _to, eamount);

            return true;
        }

        revert("Transfer not possible");

        // require(_amount <= balanceOf(_from) - (_frozenTokens[_from]), "Insufficient Balance");
        // if (_tokenIdentityRegistry.isVerified(_to) && _tokenCompliance.canTransfer(_from, _to, _amount)) {
        //     _approve(_from, msg.sender, _allowances[_from][msg.sender] - (_amount));
        //     _transfer(_from, _to, _amount);
        //     _tokenCompliance.transferred(_from, _to, _amount);
        //     return true;
        // }
        // revert("Transfer not possible");
    }

    /**
     *  @dev See {IToken-batchForcedTransfer}.
     */
    function batchForcedTransfer(
        address[] calldata _fromList,
        address[] calldata _toList,
        einput[] calldata encryptedAmounts,
        bytes calldata inputProof
    ) public override {
        for (uint256 i = 0; i < _toList.length; i++) {
            forcedTransfer(_fromList[i], _toList[i], TFHE.asEuint64(encryptedAmounts[i], inputProof));
        }
    }

    /**
     *  @dev See {IToken-batchForcedTransfer}.
     */
    function batchForcedTransfer(
        address[] calldata _fromList,
        address[] calldata _toList,
        euint64[] calldata _amounts
    ) public override {
        for (uint256 i = 0; i < _fromList.length; i++) {
            forcedTransfer(_fromList[i], _toList[i], _amounts[i]);
        }
    }

    /**
     *  @dev See {IToken-batchMint}.
     */
    function batchMint(
        address[] calldata _toList,
        einput[] calldata _eamounts,
        bytes calldata inputProof
    ) public override {
        for (uint256 i = 0; i < _toList.length; i++) {
            mint(_toList[i], TFHE.asEuint64(_eamounts[i], inputProof));
        }
    }

    /**
     *  @dev See {IToken-batchMint}.
     */
    function batchMint(address[] calldata _toList, euint64[] calldata _eamounts) public override {
        for (uint256 i = 0; i < _toList.length; i++) {
            mint(_toList[i], _eamounts[i]);
        }
    }

    /**
     *  @dev See {IToken-batchBurn}.
     */
    function batchBurn(
        address[] calldata _toList,
        einput[] calldata _eamounts,
        bytes calldata inputProof
    ) public override {
        for (uint256 i = 0; i < _toList.length; i++) {
            burn(_toList[i], TFHE.asEuint64(_eamounts[i], inputProof));
        }
    }

    /**
     *  @dev See {IToken-batchBurn}.
     */
    function batchBurn(address[] calldata _userAddresses, euint64[] calldata _eamounts) public override {
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            burn(_userAddresses[i], _eamounts[i]);
        }
    }

    /**
     *  @dev See {IToken-batchSetAddressFrozen}.
     */
    function batchSetAddressFrozen(address[] calldata _userAddresses, bool[] calldata _freeze) external override {
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            setAddressFrozen(_userAddresses[i], _freeze[i]);
        }
    }

    /**
     *  @dev See {IToken-batchFreezePartialTokens}.
     */
    function batchFreezePartialTokens(
        address[] calldata _userAddresses,
        euint64[] calldata _amounts
    ) external override {
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            freezePartialTokens(_userAddresses[i], _amounts[i]);
        }
    }

    /**
     *  @dev See {IToken-batchUnfreezePartialTokens}.
     */
    function batchUnfreezePartialTokens(
        address[] calldata _userAddresses,
        euint64[] calldata _amounts
    ) external override {
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            unfreezePartialTokens(_userAddresses[i], _amounts[i]);
        }
    }

    /**
     *  @dev See {IToken-recoveryAddress}.
     */
    function recoveryAddress(
        address _lostWallet,
        address _newWallet,
        address _investorOnchainID
    ) external override onlyAgent returns (bool) {
        require(euint64.unwrap(balanceOf(_lostWallet)) != 0, "no tokens to recover");

        IIdentity _onchainID = IIdentity(_investorOnchainID);
        bytes32 _key = keccak256(abi.encode(_newWallet));
        if (_onchainID.keyHasPurpose(_key, 1)) {
            euint64 investorTokens = _getOrZero(balanceOf(_lostWallet));
            euint64 frozenTokens = _getOrZero(_frozenTokens[_lostWallet]);

            _tokenIdentityRegistry.registerIdentity(
                _newWallet,
                _onchainID,
                _tokenIdentityRegistry.investorCountry(_lostWallet)
            );

            forcedTransfer(_lostWallet, _newWallet, investorTokens);
            freezePartialTokens(_newWallet, frozenTokens);

            if (_frozen[_lostWallet] == true) {
                setAddressFrozen(_newWallet, true);
            }

            _tokenIdentityRegistry.deleteIdentity(_lostWallet);
            emit RecoverySuccess(_lostWallet, _newWallet, _investorOnchainID);
            return true;
        }
        revert("Recovery not possible");
    }

    /**
     *  @dev See {IERC20-totalSupply}.
     */
    function totalSupply() external view override returns (euint64) {
        return _totalSupply;
    }

    /**
     *  @dev See {IERC20-allowance}.
     */
    function allowance(address _owner, address _spender) external view virtual override returns (euint64) {
        return _allowances[_owner][_spender];
    }

    /**
     *  @dev See {IToken-identityRegistry}.
     */
    function identityRegistry() external view override returns (IIdentityRegistry) {
        return _tokenIdentityRegistry;
    }

    /**
     *  @dev See {IToken-compliance}.
     */
    function compliance() external view override returns (IModularCompliance) {
        return _tokenCompliance;
    }

    /**
     *  @dev See {IToken-paused}.
     */
    function paused() external view override returns (bool) {
        return _tokenPaused;
    }

    /**
     *  @dev See {IToken-isFrozen}.
     */
    function isFrozen(address _userAddress) external view override returns (bool) {
        return _frozen[_userAddress];
    }

    /**
     *  @dev See {IToken-getFrozenTokens}.
     */
    function getFrozenTokens(address _userAddress) external view override returns (euint64) {
        return _frozenTokens[_userAddress];
    }

    /**
     *  @dev See {IToken-decimals}.
     */
    function decimals() external view override returns (uint8) {
        return _tokenDecimals;
    }

    /**
     *  @dev See {IToken-name}.
     */
    function name() external view override returns (string memory) {
        return _tokenName;
    }

    /**
     *  @dev See {IToken-onchainID}.
     */
    function onchainID() external view override returns (address) {
        return _tokenOnchainID;
    }

    /**
     *  @dev See {IToken-symbol}.
     */
    function symbol() external view override returns (string memory) {
        return _tokenSymbol;
    }

    /**
     *  @dev See {IToken-version}.
     */
    function version() external pure override returns (string memory) {
        return _TOKEN_VERSION;
    }

    /**
     *  @dev See {IToken-transfer}.
     */
    function transfer(
        address _to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public override whenNotPaused returns (bool) {
        return transfer(_to, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @notice ERC-20 overridden function that include logic to check for trade validity.
     *  Require that the msg.sender and to addresses are not frozen.
     *  Require that the value should not exceed available balance .
     *  Require that the to address is a verified address
     *  @param _to The address of the receiver
     *  @param _eamount The number of tokens to transfer
     *  @return `true` if successful and revert if unsuccessful
     */
    function transfer(address _to, euint64 _eamount) public override whenNotPaused returns (bool) {
        require(!_frozen[_to] && !_frozen[msg.sender], "wallet is frozen");
        require(
            TFHE.isSenderAllowed(_eamount),
            "TFHE: caller does not have TFHE permissions to access amount argument"
        );

        euint64 senderBalance = _getOrZero(balanceOf(msg.sender));
        euint64 senderFrozenTokens = _getOrZero(_frozenTokens[msg.sender]);

        // Debug
        require(
            TFHE.isAllowed(senderBalance, address(this)),
            "TFHE: token does not have TFHE permissions to access balance"
        );
        // Debug
        require(
            TFHE.isAllowed(senderFrozenTokens, address(this)),
            "TFHE: token does not have TFHE permissions to access frozen tokens"
        );

        // always valid
        euint64 eamount = _selectLeSub(_eamount, senderBalance, senderFrozenTokens);

        if (_tokenIdentityRegistry.isVerified(_to)) {
            // give _tokenCompliance TFHE access for 'canTransfer(...)'
            TFHE.allowTransient(eamount, address(_tokenCompliance));

            //_tokenCompliance.canTransfer(msg.sender, _to, _amount)
            ebool ecanTransfer = _tokenCompliance.canTransfer(msg.sender, _to, eamount);

            // if canTransfer failed, set the amount to 0
            eamount = TFHE.select(ecanTransfer, eamount, TFHE.asEuint64(0));

            //_transfer(msg.sender, _to, _amount)
            _transfer(msg.sender, _to, eamount);

            // give _tokenCompliance TFHE access for 'transferred(...)'
            TFHE.allowTransient(eamount, address(_tokenCompliance));

            //_tokenCompliance.transferred(msg.sender, _to, _amount)
            _tokenCompliance.transferred(msg.sender, _to, eamount);

            return true;
        }

        revert("Transfer not possible");

        // require(!_frozen[_to] && !_frozen[msg.sender], "wallet is frozen");
        // require(_amount <= balanceOf(msg.sender) - (_frozenTokens[msg.sender]), "Insufficient Balance");
        // if (_tokenIdentityRegistry.isVerified(_to) && _tokenCompliance.canTransfer(msg.sender, _to, _amount)) {
        //     4(msg.sender, _to, _amount);
        //     _tokenCompliance.transferred(msg.sender, _to, _amount);
        //     return true;
        // }
        // revert("Transfer not possible");
    }

    /**
     *  @dev See {IToken-transfer}.
     */
    function forcedTransfer(
        address _from,
        address _to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public override onlyAgent returns (bool) {
        return forcedTransfer(_from, _to, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @dev See {IToken-forcedTransfer}.
     */
    function forcedTransfer(address _from, address _to, euint64 _eamount) public override onlyAgent returns (bool) {
        require(
            TFHE.isSenderAllowed(_eamount) || TFHE.isAllowed(_eamount, address(this)),
            "TFHE: agent does not have TFHE permissions to access amount argument"
        );

        euint64 fromBalance = _getOrZero(balanceOf(_from));
        euint64 fromFrozenTokens = _getOrZero(_frozenTokens[_from]);

        // Debug
        require(
            TFHE.isAllowed(fromBalance, address(this)),
            "TFHE: token does not have TFHE permissions to access balance"
        );
        // Debug
        require(
            TFHE.isAllowed(fromFrozenTokens, address(this)),
            "TFHE: token does not have TFHE permissions to access frozen tokens"
        );

        // require(balanceOf(_from) >= _amount, "sender balance too low");
        ebool ehasBalance = TFHE.ge(fromBalance, _eamount);
        euint64 eamount = TFHE.select(ehasBalance, _eamount, TFHE.asEuint64(0));

        // uint256 freeBalance = balanceOf(_from) - (_frozenTokens[_from]);
        euint64 efreeBalance = TFHE.sub(fromBalance, fromFrozenTokens);

        //(_amount > freeBalance) && (balanceOf(_from) >= _amount)
        ebool ecanUnfreeze = TFHE.gt(_eamount, efreeBalance);
        ecanUnfreeze = TFHE.and(ecanUnfreeze, ehasBalance);

        //uint256 tokensToUnfreeze = _amount - (freeBalance)
        euint64 etokensToUnfreeze = TFHE.sub(_eamount, (efreeBalance));
        etokensToUnfreeze = TFHE.select(ecanUnfreeze, etokensToUnfreeze, TFHE.asEuint64(0));

        //_frozenTokens[_from] = _frozenTokens[_from] - (tokensToUnfreeze)
        euint64 newFromFrozenTokens = TFHE.sub(fromFrozenTokens, (etokensToUnfreeze));
        _frozenTokens[_from] = newFromFrozenTokens;

        // update frozen tokens permissions
        TFHE.allow(newFromFrozenTokens, _from);
        TFHE.allow(newFromFrozenTokens, address(this));
        // TFHE.allow(newFromFrozenTokens, msg.sender); //agent
        // allowAgents(newFromFrozenTokens);

        emit TokensUnfrozen(_from, etokensToUnfreeze);

        if (_tokenIdentityRegistry.isVerified(_to)) {
            // give _tokenCompliance TFHE access for:
            // - transferred(...)
            TFHE.allowTransient(eamount, address(_tokenCompliance));

            //_transfer(_from, _to, _amount)
            _transfer(_from, _to, eamount);

            //_tokenCompliance.transferred(_from, _to, _amount)
            _tokenCompliance.transferred(_from, _to, eamount);

            return true;
        }

        revert("Transfer not possible");

        // require(balanceOf(_from) >= _amount, "sender balance too low");
        // uint256 freeBalance = balanceOf(_from) - (_frozenTokens[_from]);

        // if (_amount > freeBalance) {
        //     uint256 tokensToUnfreeze = _amount - (freeBalance);
        //     _frozenTokens[_from] = _frozenTokens[_from] - (tokensToUnfreeze);
        //     emit TokensUnfrozen(_from, tokensToUnfreeze);
        // }
        // if (_tokenIdentityRegistry.isVerified(_to)) {
        //     _transfer(_from, _to, _amount);
        //     _tokenCompliance.transferred(_from, _to, _amount);
        //     return true;
        // }
        // revert("Transfer not possible");
    }

    /**
     *  @dev See {IToken-burn}.
     */
    function mint(address _userAddress, einput encryptedAmount, bytes calldata inputProof) public override onlyAgent {
        mint(_userAddress, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @dev See {IToken-mint}.
     */
    function mint(address _to, euint64 _eamount) public override onlyAgent {
        require(_tokenIdentityRegistry.isVerified(_to), "Identity is not verified.");
        require(TFHE.isSenderAllowed(_eamount), "TFHE: agent does not have TFHE permissions to access amount argument");
        require(euint64.unwrap(_eamount) != 0, "Uninitialized amount argument");

        // give _tokenCompliance TFHE access for:
        // - canTransfer(...)
        TFHE.allowTransient(_eamount, address(_tokenCompliance));

        ebool ecanTransfer = _tokenCompliance.canTransfer(address(0), _to, _eamount);

        // if canTransfer failed set amount to 0
        euint64 eamount = TFHE.select(ecanTransfer, _eamount, TFHE.asEuint64(0));

        _mint(_to, eamount);

        // give _tokenCompliance TFHE access for:
        // - created(...)
        TFHE.allowTransient(eamount, address(_tokenCompliance));

        _tokenCompliance.created(_to, eamount);
    }

    /**
     *  @dev See {IToken-burn}.
     */
    function burn(address _userAddress, einput encryptedAmount, bytes calldata inputProof) public override onlyAgent {
        burn(_userAddress, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @dev See {IToken-burn}.
     */
    function burn(address _userAddress, euint64 _eamount) public override onlyAgent {
        // require(balanceOf(_userAddress) >= _amount, "cannot burn more than balance");
        // uint256 freeBalance = balanceOf(_userAddress) - _frozenTokens[_userAddress];
        // if (_amount > freeBalance) {
        //     uint256 tokensToUnfreeze = _amount - (freeBalance);
        //     _frozenTokens[_userAddress] = _frozenTokens[_userAddress] - (tokensToUnfreeze);
        //     emit TokensUnfrozen(_userAddress, tokensToUnfreeze);
        // }
        // _burn(_userAddress, _amount);
        // _tokenCompliance.destroyed(_userAddress, _amount);

        require(_userAddress != address(0), "ERC20: burn from the zero address");
        require(TFHE.isSenderAllowed(_eamount), "TFHE: agent does not have TFHE permissions to access amount argument");

        euint64 userFrozenTokens = _getOrZero(_frozenTokens[_userAddress]);
        euint64 userBalance = _getOrZero(balanceOf(_userAddress));

        // Debug
        require(
            TFHE.isAllowed(userBalance, address(this)),
            "TFHE: token does not have TFHE permissions to access balance"
        );
        // Debug
        require(
            TFHE.isAllowed(userFrozenTokens, address(this)),
            "TFHE: token does not have TFHE permissions to access frozen tokens"
        );

        euint64 a = TFHE.sub(userBalance, _eamount);
        euint64 b = TFHE.sub(userFrozenTokens, a);

        ebool ecanBurn = TFHE.ge(userBalance, _eamount);
        ebool ecanUnfreeze = TFHE.gt(userFrozenTokens, a);

        ebool ecanBurnAndUnfreeze = TFHE.and(ecanBurn, ecanUnfreeze);

        euint64 etokensToUnfreeze = TFHE.select(ecanBurnAndUnfreeze, b, TFHE.asEuint64(0));
        euint64 newUserFrozenTokens = TFHE.sub(userFrozenTokens, etokensToUnfreeze);
        euint64 eamount = TFHE.select(ecanBurn, _eamount, TFHE.asEuint64(0));

        _frozenTokens[_userAddress] = newUserFrozenTokens;

        // update frozen tokens permissions
        TFHE.allow(newUserFrozenTokens, address(this));
        TFHE.allow(newUserFrozenTokens, _userAddress);
        // TFHE.allow(newUserFrozenTokens, msg.sender);
        // allowAgents(newUserFrozenTokens);

        emit TokensUnfrozen(_userAddress, etokensToUnfreeze);

        _burn(_userAddress, eamount);

        // give _tokenCompliance TFHE access for:
        // - destroyed(...)
        TFHE.allowTransient(eamount, address(_tokenCompliance));

        _tokenCompliance.destroyed(_userAddress, eamount);

        /*
        a = balanceOf(_userAddress) - _amount = newBalance
        b = _frozenTokens[_userAddress] - a = tokensToUnfreeze

                            _amount > freeBalance 
                            _amount > balanceOf(_userAddress) - _frozenTokens[_userAddress]
        _frozenTokens[_userAddress] > balanceOf(_userAddress) - _amount
        _frozenTokens[_userAddress] > a
                                  b > 0

        _amount - (freeBalance) = tokensToUnfreeze
        _amount - (freeBalance) = _amount - (balanceOf(_userAddress) - _frozenTokens[_userAddress])
        _amount - (freeBalance) = _amount - balanceOf(_userAddress) + _frozenTokens[_userAddress]
        _amount - (freeBalance) = _frozenTokens[_userAddress] - (balanceOf(_userAddress) -_amount)
        _amount - (freeBalance) = _frozenTokens[_userAddress] - a
        _amount - (freeBalance) = b
        */
    }

    /**
     *  @dev See {IToken-setAddressFrozen}.
     */
    function setAddressFrozen(address _userAddress, bool _freeze) public override onlyAgent {
        _frozen[_userAddress] = _freeze;

        emit AddressFrozen(_userAddress, _freeze, msg.sender);
    }

    /**
     *  @dev See {IToken-freezePartialTokens}.
     *  FHE: If amount exceeds balance, freeze zero instead
     */
    function freezePartialTokens(
        address _userAddress,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public override onlyAgent {
        freezePartialTokens(_userAddress, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @dev See {IToken-freezePartialTokens}.
     *  FHE: If amount exceeds balance, freeze zero instead
     */
    function freezePartialTokens(address _userAddress, euint64 _eamount) public override onlyAgent {
        // require(balance >= _frozenTokens[_userAddress] + _amount, "Amount exceeds available balance");
        // _frozenTokens[_userAddress] = _frozenTokens[_userAddress] + (_amount);
        // emit TokensFrozen(_userAddress, _amount);
        require(
            TFHE.isSenderAllowed(_eamount) || TFHE.isAllowed(_eamount, address(this)),
            "TFHE: agent does not have TFHE permissions to access amount argument"
        );

        euint64 userFrozenTokens = _getOrZero(_frozenTokens[_userAddress]);
        euint64 userBalance = _getOrZero(balanceOf(_userAddress));

        // Debug
        require(
            TFHE.isAllowed(userBalance, address(this)),
            "TFHE: token does not have TFHE permissions to access balance"
        );
        // Debug
        require(
            TFHE.isAllowed(userFrozenTokens, address(this)),
            "TFHE: token does not have TFHE permissions to access frozen tokens"
        );

        euint64 enewFrozen = TFHE.add(userFrozenTokens, _eamount);

        ebool ecanFreeze = TFHE.ge(userBalance, enewFrozen);
        euint64 eamount = TFHE.select(ecanFreeze, _eamount, TFHE.asEuint64(0));
        euint64 newUserFrozenTokens = TFHE.select(ecanFreeze, enewFrozen, userFrozenTokens);

        _frozenTokens[_userAddress] = newUserFrozenTokens;

        // update frozen tokens permissions
        TFHE.allow(newUserFrozenTokens, address(this));
        TFHE.allow(newUserFrozenTokens, _userAddress);
        // TFHE.allow(newUserFrozenTokens, msg.sender); //agent
        // allowAgents(newUserFrozenTokens);

        emit TokensFrozen(_userAddress, eamount);
    }

    /**
     *  @dev See {IToken-unfreezePartialTokens}.
     */
    function unfreezePartialTokens(
        address _userAddress,
        einput encryptedAmount,
        bytes calldata inputProof
    ) public override onlyAgent {
        unfreezePartialTokens(_userAddress, TFHE.asEuint64(encryptedAmount, inputProof));
    }

    /**
     *  @dev See {IToken-unfreezePartialTokens}.
     */
    function unfreezePartialTokens(address _userAddress, euint64 _eamount) public override onlyAgent {
        euint64 userFrozenTokens = _getOrZero(_frozenTokens[_userAddress]);

        // require(_frozenTokens[_userAddress] >= _amount, "Amount should be less than or equal to frozen tokens");
        // _frozenTokens[_userAddress] = _frozenTokens[_userAddress] - (_amount);
        // emit TokensUnfrozen(_userAddress, _amount);

        require(euint64.unwrap(userFrozenTokens) != 0, "User has no frozen tokens");
        require(TFHE.isSenderAllowed(_eamount), "TFHE: agent does not have TFHE permissions to access amount argument");
        // Debug
        require(
            TFHE.isAllowed(userFrozenTokens, address(this)),
            "TFHE: token does not have TFHE permissions to access frozen tokens"
        );

        ebool ecanUnfreeze = TFHE.ge(userFrozenTokens, _eamount);
        euint64 eamount = TFHE.select(ecanUnfreeze, _eamount, TFHE.asEuint64(0));

        euint64 newUserFrozenTokens = TFHE.sub(userFrozenTokens, (eamount));

        _frozenTokens[_userAddress] = newUserFrozenTokens;

        TFHE.allow(newUserFrozenTokens, address(this));
        TFHE.allow(newUserFrozenTokens, _userAddress);
        // TFHE.allow(newUserFrozenTokens, msg.sender); // agent
        // allowAgents(newUserFrozenTokens);

        emit TokensUnfrozen(_userAddress, eamount);
    }

    /**
     *  @dev See {IToken-setIdentityRegistry}.
     */
    function setIdentityRegistry(address _identityRegistry) public override onlyOwner {
        _tokenIdentityRegistry = IIdentityRegistry(_identityRegistry);
        emit IdentityRegistryAdded(_identityRegistry);
    }

    /**
     *  @dev See {IToken-setCompliance}.
     */
    function setCompliance(address _compliance) public override onlyOwner {
        if (address(_tokenCompliance) != address(0)) {
            _tokenCompliance.unbindToken(address(this));
        }
        _tokenCompliance = IModularCompliance(_compliance);
        _tokenCompliance.bindToken(address(this));

        if (euint64.unwrap(_totalSupply) != 0) {
            TFHE.allow(_totalSupply, address(_tokenCompliance)); // give TFHE access to compliance
        }

        emit ComplianceAdded(_compliance);
    }

    /**
     *  @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address _userAddress) public view override returns (euint64) {
        return _balances[_userAddress];
    }

    /**
     *  @dev See {ERC20-_transfer}.
     */
    function _transfer(address _from, address _to, euint64 _eamount) internal virtual {
        require(_from != address(0), "ERC20: transfer from the zero address");
        require(_to != address(0), "ERC20: transfer to the zero address");

        // Debug
        require(
            TFHE.isAllowed(_eamount, address(this)),
            "TFHE: token does not have TFHE permissions to access amount argument"
        );

        _beforeTokenTransfer(_from, _to, _eamount);

        euint64 newBalanceFrom = TFHE.sub(_balances[_from], _eamount);
        euint64 newBalanceTo = TFHE.add(_balances[_to], _eamount);

        _balances[_from] = newBalanceFrom;
        _balances[_to] = newBalanceTo;

        TFHE.allow(newBalanceFrom, address(this));
        TFHE.allow(newBalanceFrom, _from);
        //allowAgents(newBalanceFrom);

        TFHE.allow(newBalanceTo, address(this));
        TFHE.allow(newBalanceTo, _to);
        //allowAgents(newBalanceTo);

        // _balances[_from] = _balances[_from] - _amount;
        // _balances[_to] = _balances[_to] + _amount;
        emit Transfer(_from, _to, _eamount);
    }

    /**
     *  @dev See {ERC20-_mint}.
     */
    function _mint(address _userAddress, euint64 _eamount) internal virtual {
        require(_userAddress != address(0), "ERC20: mint to the zero address");

        // Debug
        require(
            TFHE.isAllowed(_eamount, address(this)),
            "TFHE: token does not have TFHE permissions to access amount argument"
        );

        _beforeTokenTransfer(address(0), _userAddress, _eamount);

        // Debug
        require(
            euint64.unwrap(_totalSupply) == 0 || TFHE.isAllowed(_totalSupply, address(this)),
            "TFHE: token does not have TFHE permissions to access totalSupply"
        );
        // Debug
        require(
            euint64.unwrap(_balances[_userAddress]) == 0 || TFHE.isAllowed(_balances[_userAddress], address(this)),
            "TFHE: token does not have TFHE permissions to access balance"
        );

        _totalSupply = TFHE.add(_totalSupply, _eamount);
        _balances[_userAddress] = TFHE.add(_balances[_userAddress], _eamount);

        TFHE.allow(_balances[_userAddress], address(this));
        TFHE.allow(_balances[_userAddress], _userAddress);
        // TFHE.allow(_balances[_userAddress], msg.sender); //agent
        // allowAgents(_balances[_userAddress]);

        // _totalSupply is a shared value accessible to all agents
        TFHE.allow(_totalSupply, address(this));
        TFHE.allow(_totalSupply, address(_tokenCompliance)); // give TFHE access to compliance

        // TFHE.allow(_totalSupply, msg.sender); //agent
        // allowAgents(_totalSupply); //allow other agents

        emit Transfer(address(0), _userAddress, _eamount);
    }

    /**
     *  @dev See {ERC20-_burn}.
     */
    function _burn(address _userAddress, euint64 _eamount) internal virtual {
        require(_userAddress != address(0), "ERC20: burn from the zero address");

        // Debug
        require(
            TFHE.isAllowed(_eamount, address(this)),
            "TFHE: token does not have TFHE permissions to access amount argument"
        );

        _beforeTokenTransfer(_userAddress, address(0), _eamount);

        // Debug
        require(
            euint64.unwrap(_totalSupply) == 0 || TFHE.isAllowed(_totalSupply, address(this)),
            "TFHE: token does not have TFHE permissions to access totalSupply"
        );
        // Debug
        require(
            euint64.unwrap(_balances[_userAddress]) == 0 || TFHE.isAllowed(_balances[_userAddress], address(this)),
            "TFHE: token does not have TFHE permissions to access balance"
        );

        _balances[_userAddress] = TFHE.sub(_balances[_userAddress], _eamount);
        _totalSupply = TFHE.sub(_totalSupply, _eamount);

        TFHE.allow(_balances[_userAddress], address(this));
        TFHE.allow(_balances[_userAddress], _userAddress);
        // TFHE.allow(_balances[_userAddress], msg.sender); //agent
        // allowAgents(_balances[_userAddress]);

        // _totalSupply is a shared value accessible to all agents
        TFHE.allow(_totalSupply, address(this));
        TFHE.allow(_totalSupply, address(_tokenCompliance)); // give TFHE access to compliance
        // TFHE.allow(_totalSupply, msg.sender); //agent
        // allowAgents(_totalSupply); //allow other agents

        emit Transfer(_userAddress, address(0), _eamount);
    }

    /**
     *  @dev See {ERC20-_approve}.
     */
    function _approve(address _owner, address _spender, euint64 _eamount) internal virtual {
        require(_owner != address(0), "ERC20: approve from the zero address");
        require(_spender != address(0), "ERC20: approve to the zero address");

        // Debug
        require(
            TFHE.isAllowed(_eamount, address(this)),
            "TFHE: token does not have TFHE permissions to access amount argument"
        );

        _allowances[_owner][_spender] = _eamount;

        // Stored by 'this', keep TFHE permissions.
        TFHE.allow(_eamount, address(this));
        // Allow '_owner' TFHE persmissions for external access.
        TFHE.allow(_eamount, _owner);
        // Allow '_spender' TFHE persmissions for external access.
        TFHE.allow(_eamount, _spender);

        emit Approval(_owner, _spender, _eamount);
    }

    /**
     *  @dev See {ERC20-_beforeTokenTransfer}.
     */
    // solhint-disable-next-line no-empty-blocks
    function _beforeTokenTransfer(address _from, address _to, euint64 _amount) internal virtual {}

    /**
     * return (a <= b - c) ? a : 0
     */
    function _selectLeSub(euint64 a, euint64 b, euint64 c) private returns (euint64) {
        ebool cond = TFHE.le(a, TFHE.sub(b, c));
        return TFHE.select(cond, a, TFHE.asEuint64(0));
    }

    /**
     * @dev returns euint64(0) if lhs < rhs otherwise (lhs - rhs)
     * - lhs can be 0 (uninitialized)
     * - rhs can be 0 (uninitialized)
     */
    function _clampedSub(euint64 lhs, euint64 rhs) private returns (euint64) {
        ebool valid = TFHE.ge(lhs, rhs);
        euint64 res = TFHE.sub(lhs, rhs);
        return TFHE.select(valid, res, TFHE.asEuint64(0));
    }

    function _getOrZero(euint64 value) private returns (euint64) {
        if (euint64.unwrap(value) != 0) {
            return value;
        }
        return TFHE.asEuint64(0);
    }
}

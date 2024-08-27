## Hardhat plugins import order

`hardhat-fhevm` must be imported last:

✅ OK:
```js
import 'hardhat-ignore-warnings';
import 'hardhat-fhevm';
```

❌ NOT OK (no dot):

```js
import 'hardhat-fhevm';
import 'hardhat-ignore-warnings';
```

Both plugins are overriding the built-in TASK_TEST. However, `hardhat-fhevm` must be called first by the runtime to start the fhevm network.
If `hardhat-gas-reporter` is called first and `hardhat-fhevm` second the following error will be raised:

```
Error HH108: Cannot connect to the network fhevm.
Please make sure your node is running, and check your internet connection and networks config
```



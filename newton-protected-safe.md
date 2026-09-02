# Newton-protected Safe (passkey demo)

A Sepolia honey-pot Safe holds USDC. A published throwaway key is a Safe
owner, but a Guard reverts every owner `execTransaction`, so that key cannot
send, unset the Guard, or disable the module. The only spend path is a Newton
PolicyClient enabled as a Safe module: after a passkey attestation it calls
`execTransactionFromModule` → `USDC.transfer`.

Product brief: [`newton-safe-demo-brief.txt`](newton-safe-demo-brief.txt).

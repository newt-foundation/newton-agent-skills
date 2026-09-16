# Secrets vs Shield owner

`newton-vault-shield` currently says not to `setPolicyClientOwner` and
that `shield.uploadSecrets` only needs `NEWTON_API_KEY`. Live gateway
behavior is stricter.

`newt_storeEncryptedSecrets` still checks that the dashboard identity
behind the API key **is** Shield `getOwner()`. If the clone owner is the
curator key and the key was minted for the login wallet, evaluate /
upload returns `AuthorizationFailed: policy client … owned by <curator>,
not by caller <dashboard wallet>`.

Do not print those addresses from logs into a place that looks like a
secret. The 400 body names public Ethereum addresses.

## Pick one

**A. Transfer owner (typical dogfood with a dashboard API key)**

1. `createShield` (curator key; curator is owner + approved delegate)
2. `setParams` **now** — curator must still own the clone
3. Grant allocator on the vault
4. `setPolicyClientOwner(dashboardWallet)` where `dashboardWallet` is the
   address `newton-cli login` / keys identity (do not invent it)
5. `setApprovedDelegate(curator, true)` so the curator key can still
   send typed actions
6. `uploadSecrets`
7. Typed allow / deny

After step 4 the curator **cannot** `setPolicy` or `setParams` on that
clone. Wrong params or a new Policy address → new Shield `version`, not
another `setParams` from the curator key.

**B. Curator-owned API key**

Mint or select a gateway key whose dashboard identity **is** the curator
address. Then skip owner transfer. `uploadSecrets` and evaluate succeed
while the curator keeps `setParams`. Only do this if such a key already
exists or the user asks to mint one — do not invent identities.

## Order that failed in dogfood

Owner transfer **before** `setParams` of the envelope Policy left a clone
that could upload secrets but could not retarget params. The next Policy
needed `createShield({ version: n+1n, allowNewVersion: true })`.

## `setApprovedDelegate`

The initial Shield owner is an approved delegate at clone init. After an
ownership handoff, the old curator key is no longer owner; it must be an
approved delegate to `sendCall` / typed `reallocate`.

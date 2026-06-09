<script>
  import { onMount } from "svelte";
  import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
  import { api } from "../lib/api.js";
  import { logout, user } from "../lib/stores.js";
  import { navigate } from "../router/index.js";

  let oldPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let passwordError = $state("");
  let passwordSuccess = $state("");
  let passwordLoading = $state(false);
  let passwordFormEl;

  let newEmail = $state("");
  let emailError = $state("");
  let emailSuccess = $state("");
  let emailLoading = $state(false);
  let emailFormEl;

  let deletePassword = $state("");
  let deleteConfirm = $state("");
  let deleteError = $state("");
  let deleteLoading = $state(false);
  let deleteFormEl;

  let passkeys = $state([]);
  let passkeySupported = $state(false);
  let passkeyError = $state("");
  let passkeySuccess = $state("");
  let passkeyAdding = $state(false);

  onMount(() => {
    passkeySupported = browserSupportsWebAuthn();
    loadPasskeys();
  });

  async function loadPasskeys() {
    try {
      const data = await api("/api/auth/passkeys");
      passkeys = data.passkeys;
    } catch (err) {
      passkeyError = err.message;
    }
  }

  async function handleAddPasskey() {
    passkeyError = "";
    passkeySuccess = "";
    passkeyAdding = true;
    try {
      const { options } = await api("/api/auth/passkey/register/options", {
        method: "POST",
      });
      const response = await startRegistration({ optionsJSON: options });
      await api("/api/auth/passkey/register/verify", {
        method: "POST",
        body: JSON.stringify({ response }),
      });
      passkeySuccess = "Passkey added.";
      await loadPasskeys();
    } catch (err) {
      if (err.name === "InvalidStateError") {
        passkeyError = "This device already has a passkey for your account.";
      } else if (err.name !== "NotAllowedError") {
        passkeyError = err.message;
      }
    } finally {
      passkeyAdding = false;
    }
  }

  async function handleDeletePasskey(id) {
    passkeyError = "";
    passkeySuccess = "";
    try {
      await api(`/api/auth/passkeys/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      passkeys = passkeys.filter((p) => p.id !== id);
    } catch (err) {
      passkeyError = err.message;
    }
  }

  function handlePasswordKeydown(e) {
    if (e.key === "Enter") {
      passwordFormEl.requestSubmit();
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    passwordError = "";
    passwordSuccess = "";

    if (newPassword !== confirmPassword) {
      passwordError = "New passwords do not match";
      return;
    }

    passwordLoading = true;
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      passwordSuccess = "Password changed successfully.";
      oldPassword = "";
      newPassword = "";
      confirmPassword = "";
    } catch (err) {
      passwordError = err.message;
    } finally {
      passwordLoading = false;
    }
  }

  function handleEmailKeydown(e) {
    if (e.key === "Enter") {
      emailFormEl.requestSubmit();
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    emailError = "";
    emailSuccess = "";

    emailLoading = true;
    try {
      await api("/api/auth/change-email", {
        method: "POST",
        body: JSON.stringify({ email: newEmail }),
      });
      emailSuccess = "Email changed. A verification email has been sent to your new address.";
      newEmail = "";
    } catch (err) {
      emailError = err.message;
    } finally {
      emailLoading = false;
    }
  }

  function handleDeleteKeydown(e) {
    if (e.key === "Enter") {
      deleteFormEl.requestSubmit();
    }
  }

  async function handleDeleteSubmit(e) {
    e.preventDefault();
    deleteError = "";

    deleteLoading = true;
    try {
      await api("/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      logout();
      navigate("/");
    } catch (err) {
      deleteError = err.message;
      deleteLoading = false;
    }
  }
</script>

<div class="form-card">
  <h1>Settings</h1>

  <h2 style="margin-top: 1.5rem; margin-bottom: 1rem; font-size: 1.1rem;">Change password</h2>

  <form bind:this={passwordFormEl} onsubmit={handlePasswordSubmit}>
    <div class="form-group">
      <label for="old-password">Current password</label>
      <input id="old-password" type="password" bind:value={oldPassword} placeholder="current password" required onkeydown={handlePasswordKeydown} />
    </div>

    <div class="form-group">
      <label for="new-password">New password</label>
      <input id="new-password" type="password" bind:value={newPassword} placeholder="new password" required minlength={6} onkeydown={handlePasswordKeydown} />
    </div>

    <div class="form-group">
      <label for="confirm-password">Confirm new password</label>
      <input id="confirm-password" type="password" bind:value={confirmPassword} placeholder="confirm new password" required minlength={6} onkeydown={handlePasswordKeydown} />
    </div>

    {#if passwordError}
      <p class="form-error">{passwordError}</p>
    {/if}

    {#if passwordSuccess}
      <p class="form-success">{passwordSuccess}</p>
    {/if}

    <button type="submit" class="btn-primary" disabled={passwordLoading}>
      {passwordLoading ? "Saving…" : "Change password"}
    </button>
  </form>

  <hr style="margin: 2rem 0; border: none; border-top: 1px solid var(--border-color);" />

  <h2 style="margin-bottom: 1rem; font-size: 1.1rem;">Change email</h2>

  {#if $user?.email}
    <p style="margin-bottom: 1rem; font-size: 0.9rem; color: #555;">
      Current email: <strong>{$user.email}</strong>
    </p>
  {/if}

  <form bind:this={emailFormEl} onsubmit={handleEmailSubmit}>
    <div class="form-group">
      <label for="new-email">New email address</label>
      <input id="new-email" type="email" bind:value={newEmail} placeholder="new@example.com" required onkeydown={handleEmailKeydown} />
    </div>

    {#if emailError}
      <p class="form-error">{emailError}</p>
    {/if}

    {#if emailSuccess}
      <p class="form-success">{emailSuccess}</p>
    {/if}

    <button type="submit" class="btn-primary" disabled={emailLoading}>
      {emailLoading ? "Saving…" : "Change email"}
    </button>
  </form>

  <hr style="margin: 2rem 0; border: none; border-top: 1px solid var(--border-color);" />

  <h2 style="margin-bottom: 1rem; font-size: 1.1rem;">Passkeys</h2>

  <p style="font-size: 0.9rem; color: #555; margin-bottom: 1rem;">
    Passkeys let you log in with your fingerprint, face, or device PIN instead of your password.
  </p>

  {#if passkeys.length > 0}
    <ul class="passkey-list">
      {#each passkeys as passkey (passkey.id)}
        <li class="passkey-item">
          <div>
            <div class="passkey-name">{passkey.name}</div>
            <div class="passkey-meta">
              Added {new Date(passkey.createdAt + "Z").toLocaleDateString()}{passkey.lastUsedAt ? ` · Last used ${new Date(passkey.lastUsedAt + "Z").toLocaleDateString()}` : ""}
            </div>
          </div>
          <button type="button" class="btn-secondary" onclick={() => handleDeletePasskey(passkey.id)}>
            Remove
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if passkeyError}
    <p class="form-error">{passkeyError}</p>
  {/if}

  {#if passkeySuccess}
    <p class="form-success">{passkeySuccess}</p>
  {/if}

  {#if passkeySupported}
    <button type="button" class="btn-primary" onclick={handleAddPasskey} disabled={passkeyAdding}>
      {passkeyAdding ? "Waiting for passkey…" : "Add a passkey"}
    </button>
  {:else}
    <p style="font-size: 0.9rem; color: #555;">This browser does not support passkeys.</p>
  {/if}

  <hr style="margin: 2rem 0; border: none; border-top: 1px solid var(--border-color);" />

  <h2 style="margin-bottom: 1rem; font-size: 1.1rem; color: #dc2626;">Delete account</h2>

  <p style="font-size: 0.9rem; color: #444; margin-bottom: 1rem;">This will permanently delete your account. Your posts will remain but be attributed to a deleted user. Your direct messages and feedback will be removed.</p>

  <form bind:this={deleteFormEl} onsubmit={handleDeleteSubmit}>
    <div class="form-group">
      <label for="delete-password">Current password</label>
      <input id="delete-password" type="password" bind:value={deletePassword} placeholder="current password" required onkeydown={handleDeleteKeydown} />
    </div>

    <div class="form-group">
      <label for="delete-confirm">Type "delete" to confirm</label>
      <input id="delete-confirm" type="text" bind:value={deleteConfirm} placeholder="delete" required onkeydown={handleDeleteKeydown} />
    </div>

    {#if deleteError}
      <p class="form-error">{deleteError}</p>
    {/if}

    <button type="submit" class="btn-danger" disabled={deleteLoading || deleteConfirm !== "delete"}>
      {deleteLoading ? "Deleting…" : "Delete account"}
    </button>
  </form>
</div>

<style>
  .form-success {
    color: #16a34a;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .passkey-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
  }

  .passkey-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .passkey-name {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .passkey-meta {
    font-size: 0.8rem;
    color: #777;
  }
</style>
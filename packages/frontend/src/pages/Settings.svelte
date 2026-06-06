<script>
  import { api } from "../lib/api.js";
  import { logout } from "../lib/stores.js";
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
</style>
<script>
  import { api } from "../lib/api.js";

  let oldPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let error = $state("");
  let success = $state("");
  let loading = $state(false);
  let formEl;

  function handleKeydown(e) {
    if (e.key === "Enter") {
      formEl.requestSubmit();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    error = "";
    success = "";

    if (newPassword !== confirmPassword) {
      error = "New passwords do not match";
      return;
    }

    loading = true;
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      success = "Password changed successfully.";
      oldPassword = "";
      newPassword = "";
      confirmPassword = "";
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="form-card">
  <h1>Settings</h1>

  <h2 style="margin-top: 1.5rem; margin-bottom: 1rem; font-size: 1.1rem;">Change password</h2>

  <form bind:this={formEl} onsubmit={handleSubmit}>
    <div class="form-group">
      <label for="old-password">Current password</label>
      <input id="old-password" type="password" bind:value={oldPassword} placeholder="current password" required onkeydown={handleKeydown} />
    </div>

    <div class="form-group">
      <label for="new-password">New password</label>
      <input id="new-password" type="password" bind:value={newPassword} placeholder="new password" required minlength={6} onkeydown={handleKeydown} />
    </div>

    <div class="form-group">
      <label for="confirm-password">Confirm new password</label>
      <input id="confirm-password" type="password" bind:value={confirmPassword} placeholder="confirm new password" required minlength={6} onkeydown={handleKeydown} />
    </div>

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    {#if success}
      <p class="form-success">{success}</p>
    {/if}

    <button type="submit" class="btn-primary" disabled={loading}>
      {loading ? "Saving…" : "Change password"}
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

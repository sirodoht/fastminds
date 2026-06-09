<script>
  import { onMount } from "svelte";
  import {
    browserSupportsWebAuthn,
    browserSupportsWebAuthnAutofill,
  } from "@simplewebauthn/browser";
  import { Link, navigate } from "../router/index.js";
  import { login, loginWithPasskey } from "../lib/stores.js";

  let username = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);
  let passkeySupported = $state(false);
  let passkeyLoading = $state(false);
  let formEl;

  onMount(() => {
    passkeySupported = browserSupportsWebAuthn();
    if (passkeySupported) {
      startAutofill();
    }
  });

  async function startAutofill() {
    try {
      if (!(await browserSupportsWebAuthnAutofill())) return;
      await loginWithPasskey(true);
      navigate("/");
    } catch {
      // Autofill ceremony cancelled or superseded; password login still works.
    }
  }

  function handleKeydown(e) {
    if (e.key === "Enter") {
      formEl.requestSubmit();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    error = "";
    loading = true;
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function handlePasskeyLogin() {
    error = "";
    passkeyLoading = true;
    try {
      await loginWithPasskey();
      navigate("/");
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        error = err.message;
      }
    } finally {
      passkeyLoading = false;
    }
  }
</script>

<div class="form-card">
  <h1>Log in</h1>

  <form bind:this={formEl} onsubmit={handleSubmit}>
    <div class="form-group">
      <label for="username">Username</label>
      <input id="username" type="text" bind:value={username} placeholder="your username" autocomplete="username webauthn" required minlength={3} />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input id="password" type="password" bind:value={password} placeholder="your password" autocomplete="current-password" required onkeydown={handleKeydown} />
    </div>

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    <button type="submit" class="btn-primary" disabled={loading}>
      {loading ? "Logging in…" : "Log in"}
    </button>
  </form>

  {#if passkeySupported}
    <div class="passkey-divider">or</div>
    <button type="button" class="btn-secondary" onclick={handlePasskeyLogin} disabled={passkeyLoading}>
      {passkeyLoading ? "Waiting for passkey…" : "Log in with a passkey"}
    </button>
  {/if}

  <div class="form-footer">
    No account? <Link href="/register">Register</Link>
  </div>
</div>

<style>
  .passkey-divider {
    text-align: center;
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 1rem 0;
  }
</style>

<script>
  import { verifyEmail } from "../lib/stores.js";
  import { navigate } from "../router/index.js";
  import { onMount } from "svelte";

  let status = $state("verifying");
  let message = $state("Verifying your email…");

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      status = "error";
      message = "Invalid verification link. Missing token.";
      return;
    }
    try {
      await verifyEmail(token);
      status = "success";
      message = "Email verified successfully! You can now use fastminds.";
      setTimeout(() => navigate("/"), 2000);
    } catch {
      status = "error";
      message = "Invalid or expired verification link.";
    }
  });
</script>

<div class="verify-wrapper">
  <div class="form-card verify-card">
    <h1>Email Verification</h1>

    <div class="status-icon">
      {#if status === "verifying"}
        <span class="spinner"></span>
      {:else if status === "success"}
        <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="32" height="32">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="32" height="32">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      {/if}
    </div>

    <p class="verify-message {status}">
      {message}
    </p>
  </div>
</div>

<style>
  .verify-wrapper {
    display: flex;
    justify-content: center;
    padding-top: 80px;
  }

  .verify-card {
    max-width: 420px;
    width: 100%;
    text-align: center;
  }

  .verify-card h1 {
    margin-bottom: 20px;
  }

  .status-icon {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--border);
    border-top-color: var(--orange);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .verify-message {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--text-muted);
    text-align: center;
  }

  .verify-message.success {
    color: #16a34a;
  }

  .verify-message.error {
    color: #ef4444;
  }
</style>

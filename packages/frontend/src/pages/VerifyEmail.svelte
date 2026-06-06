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

<div class="form-card">
  <h1>Email Verification</h1>
  <p class={status === "error" ? "form-error" : status === "success" ? "form-success" : ""}>
    {message}
  </p>
</div>

<style>
  .form-success {
    color: var(--success, #16a34a);
    text-align: center;
  }
</style>

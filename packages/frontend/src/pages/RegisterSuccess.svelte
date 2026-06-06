<script>
  import { onMount } from "svelte";
  import { navigate } from "../router/index.js";
  import { register } from "../lib/stores.js";

  let error = $state("");
  let loading = $state(true);

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      error = "Missing session ID";
      loading = false;
      return;
    }

    try {
      await register(sessionId);
      navigate("/");
    } catch (err) {
      error = err.message;
      loading = false;
    }
  });
</script>

<div class="form-card">
  <h1>Completing registration…</h1>

  {#if loading}
    <p>Verifying your payment. Please wait.</p>
  {:else if error}
    <p class="form-error">{error}</p>
    <button class="btn-primary" onclick={() => navigate("/register")}>
      Back to registration
    </button>
  {/if}
</div>

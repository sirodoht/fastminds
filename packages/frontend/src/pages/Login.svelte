<script>
  import { Link, navigate } from "../router/index.js";
  import { login } from "../lib/stores.js";

  let username = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

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
</script>

<div class="form-card">
  <h1>Log in</h1>

  <form onsubmit={handleSubmit}>
    <div class="form-group">
      <label for="username">Username</label>
      <input id="username" type="text" bind:value={username} placeholder="your username" required minlength={3} />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input id="password" type="password" bind:value={password} placeholder="your password" required minlength={6} />
    </div>

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    <button type="submit" class="btn-primary" disabled={loading}>
      {loading ? "Logging in…" : "Log in"}
    </button>
  </form>

  <div class="form-footer">
    No account? <Link href="/register">Register</Link>
  </div>
</div>

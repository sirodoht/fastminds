<script>
  import { Link, navigate } from "../router/index.js";
  import { register } from "../lib/stores.js";

  let username = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    error = "";
    loading = true;
    try {
      await register(username, password);
      navigate("/");
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="form-card">
  <h1>Create an account</h1>

  <form onsubmit={handleSubmit}>
    <div class="form-group">
      <label for="username">Username</label>
      <input id="username" type="text" bind:value={username} placeholder="choose a username" required minlength={3} />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input id="password" type="password" bind:value={password} placeholder="choose a password" required minlength={6} />
    </div>

    {#if error}
      <p class="form-error">{error}</p>
    {/if}

    <button type="submit" class="btn-primary" disabled={loading}>
      {loading ? "Registering…" : "Register"}
    </button>
  </form>

  <div class="form-footer">
    Already have an account? <Link href="/login">Log in</Link>
  </div>
</div>

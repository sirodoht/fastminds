<script>
  import { onMount } from "svelte";
  import { api } from "../lib/api.js";
  import { navigate } from "../router/index.js";

  let users = $state([]);
  let loading = $state(true);
  let error = $state("");
  let page = $state(1);
  let total = $state(0);
  let limit = $state(20);

  async function fetchUsers() {
    loading = true;
    error = "";
    try {
      const data = await api(`/api/admin/users?page=${page}`);
      users = data.users;
      total = data.total;
      limit = data.limit;
      page = data.page;
    } catch (err) {
      error = err.message || "Failed to load users.";
    } finally {
      loading = false;
    }
  }

  onMount(fetchUsers);

  let hasNext = $derived(page * limit < total);
  let hasPrev = $derived(page > 1);
</script>

{#if loading}
  <div class="panel">
    <div class="panel-body" style="text-align:center;padding:40px;color:var(--text-muted)">
      Loading users…
    </div>
  </div>
{:else if error}
  <div class="panel">
    <div class="panel-body" style="color:var(--orange)">{error}</div>
  </div>
{:else}
  <div class="panel">
    <div class="panel-header" style="display:flex;justify-content:space-between;align-items:center">
      <span>All Users</span>
      <span style="font-size:0.8rem;font-weight:400">{total} total</span>
    </div>
    <div class="panel-body" style="padding:0">
      {#if users.length === 0}
        <div style="padding:24px;text-align:center;color:var(--text-muted)">
          No users yet.
        </div>
      {:else}
        <div class="table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Email Verified</th>
                <th>Payment Verified</th>
                <th>Admin</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {#each users as u (u.id)}
                <tr>
                  <td>
                    <a href="/profile/{u.username}" onclick={(e) => { e.preventDefault(); navigate(`/profile/${u.username}`); }}>
                      {u.username}
                    </a>
                  </td>
                  <td>{u.email || "—"}</td>
                  <td>
                    <span class="badge" class:verified={u.emailVerified} class:unverified={!u.emailVerified}>
                      {u.emailVerified ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>
                    <span class="badge" class:verified={u.paymentVerified} class:unverified={!u.paymentVerified}>
                      {u.paymentVerified ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>
                    <span class="badge" class:verified={u.isAdmin} class:unverified={!u.isAdmin}>
                      {u.isAdmin ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      {#if total > limit}
        <div class="pagination" style="border-top:1px solid var(--border);margin-top:0;border-radius:0">
          <button disabled={!hasPrev} onclick={() => { page--; fetchUsers(); }}>Previous</button>
          <span class="page-info">Page {page} of {Math.ceil(total / limit)}</span>
          <button disabled={!hasNext} onclick={() => { page++; fetchUsers(); }}>Next</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .table-wrapper {
    overflow-x: auto;
  }
  .admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .admin-table thead tr {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
  }
  .admin-table th {
    text-align: left;
    padding: 8px 12px;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .admin-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    white-space: nowrap;
  }
  .admin-table tbody tr:last-child td {
    border-bottom: none;
  }
  .admin-table tbody tr:hover {
    background: var(--bg-card);
  }
  .admin-table a {
    color: var(--blue-link);
    text-decoration: none;
    font-weight: 500;
  }
  .admin-table a:hover {
    text-decoration: underline;
  }
  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge.verified {
    background: #d1fae5;
    color: #065f46;
  }
  .badge.unverified {
    background: #fee2e2;
    color: #991b1b;
  }
</style>

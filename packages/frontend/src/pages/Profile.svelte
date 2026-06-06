<script>
  import Link from "../router/Link.svelte";
  import { user } from "../lib/stores.js";
  import { api } from "../lib/api.js";
  import { onMount } from "svelte";

  let { params } = $props();

  let username = $derived(params.address);
  let isOwnProfile = $derived($user?.username === username);

  let profileUser = $state(null);
  let reputation = $state(null);
  let stats = $state(null);
  let loading = $state(true);
  let error = $state("");

  async function loadProfile() {
    try {
      const userData = await api(`/api/users/${username}`);
      profileUser = userData.user;

      const [reputationData, statsData] = await Promise.all([
        api(`/api/users/${profileUser.id}/reputation`),
        api(`/api/users/${profileUser.id}/stats`),
      ]);

      reputation = reputationData;
      stats = statsData;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadProfile();
  });

  const positiveLabels = [
    "Insightful", "Curious", "Kind", "Challenging",
  ];

  const negativeLabels = [
    "AI", "Jerk", "Dogmatic", "Bad Faith", "Rambling",
  ];

  const neutralLabels = [
    "Weird", "Contrarian",
  ];

  function getLabelColor(label) {
    if (positiveLabels.includes(label)) return "positive";
    if (negativeLabels.includes(label)) return "negative";
    return "neutral";
  }
</script>

{#if loading}
  <div class="panel">
    <div class="panel-body" style="color:var(--text-muted);text-align:center;padding:20px">
      Loading profile…
    </div>
  </div>
{:else if error}
  <div class="panel">
    <div class="panel-body form-error" style="text-align:center;padding:20px">
      {error}
    </div>
  </div>
{:else if profileUser}
  <div class="profile-card">
    <div class="profile-header">
      <div class="profile-avatar">
        {profileUser.username.charAt(0).toUpperCase()}
      </div>
      <div class="profile-info">
        <h1>u/{profileUser.username}</h1>
        {#if !isOwnProfile}
          <Link href="/messages/{profileUser.username}" class="btn-secondary" style="margin-top:8px">Message</Link>
        {/if}
      </div>
    </div>
  </div>

  <div class="panel" style="margin-top:12px">
    <div class="panel-header">Statistics</div>
    <div class="panel-body stats-grid">
      <div class="stat-item">
        <div class="stat-value">{stats.totalConversations}</div>
        <div class="stat-label">Conversations</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{stats.conversationsStarted}</div>
        <div class="stat-label">Started</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{stats.dmsReceived}</div>
        <div class="stat-label">DMs Received</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{stats.averageConversationLength.toFixed(1)}</div>
        <div class="stat-label">Avg Length</div>
      </div>
    </div>
  </div>

  <div class="panel" style="margin-top:12px">
    <div class="panel-header">Reputation</div>
    <div class="panel-body">
      {#if reputation.hidden}
        <div class="reputation-hidden">
          <p>Reputation is hidden until this user has received feedback from 10 conversations.</p>
        </div>
      {:else}
        {#if reputation.positive.length > 0}
          <div class="label-section">
            <div class="label-section-title">Positive</div>
            <div class="label-list">
              {#each reputation.positive as item}
                <span class="label-tag {getLabelColor(item.label)}">
                  {item.label}
                  <span class="label-count">{item.rawCount}</span>
                </span>
              {/each}
            </div>
          </div>
        {/if}

        {#if reputation.negative.length > 0}
          <div class="label-section">
            <div class="label-section-title">Negative</div>
            <div class="label-list">
              {#each reputation.negative as item}
                <span class="label-tag {getLabelColor(item.label)}">
                  {item.label}
                  <span class="label-count">{item.rawCount}</span>
                </span>
              {/each}
            </div>
          </div>
        {/if}

        {#if reputation.neutral.length > 0}
          <div class="label-section">
            <div class="label-section-title">Neutral</div>
            <div class="label-list">
              {#each reputation.neutral as item}
                <span class="label-tag {getLabelColor(item.label)}">
                  {item.label}
                  <span class="label-count">{item.rawCount}</span>
                </span>
              {/each}
            </div>
          </div>
        {/if}

        {#if reputation.positive.length === 0 && reputation.negative.length === 0 && reputation.neutral.length === 0}
          <div class="reputation-empty">No reputation labels yet.</div>
        {/if}
      {/if}
    </div>
  </div>

  <div class="panel" style="margin-top:12px">
    <div class="panel-header">Posts</div>
    <div class="panel-body" style="color:var(--text-muted);font-size:.85rem;text-align:center;padding:20px">
      No posts yet.
    </div>
  </div>
{/if}

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 16px;
  }
  .stat-item {
    text-align: center;
  }
  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .reputation-hidden {
    padding: 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .reputation-empty {
    padding: 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .label-section {
    margin-bottom: 16px;
  }
  .label-section-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }
  .label-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .label-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    border: 1px solid;
  }
  .label-tag.positive {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: #16a34a;
  }
  .label-tag.negative {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #dc2626;
  }
  .label-tag.neutral {
    background: rgba(107, 114, 128, 0.1);
    border-color: rgba(107, 114, 128, 0.3);
    color: #4b5563;
  }
  .label-count {
    font-size: 0.75rem;
    font-weight: 600;
    opacity: 0.7;
  }
  @media (max-width: 640px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>

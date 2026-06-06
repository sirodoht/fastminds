<script>
  import { onMount } from "svelte";
  import { api } from "../lib/api.js";

  let reports = $state([]);
  let loading = $state(true);
  let error = $state("");
  let page = $state(1);
  let total = $state(0);
  let limit = $state(20);
  let statusFilter = $state("pending");

  let resolvingReportId = $state(null);
  let actionType = $state("");
  let actionNote = $state("");
  let resolveLoading = $state(false);
  let resolveError = $state("");

  const actions = [
    { value: "warning", label: "Warning" },
    { value: "suspend", label: "Suspend" },
    { value: "ban", label: "Ban" },
    { value: "content_removed", label: "Content Removed" },
    { value: "content_hidden", label: "Content Hidden" },
    { value: "no_action", label: "No Action" },
  ];

  async function fetchReports() {
    loading = true;
    error = "";
    try {
      const data = await api(`/api/moderation/reports?status=${statusFilter}&page=${page}`);
      reports = data.reports;
      total = data.total;
      limit = data.limit;
      page = data.page;
    } catch (err) {
      error = err.message || "Failed to load reports.";
    } finally {
      loading = false;
    }
  }

  onMount(fetchReports);

  function openResolve(id) {
    resolvingReportId = id;
    actionType = "";
    actionNote = "";
    resolveError = "";
  }

  function closeResolve() {
    resolvingReportId = null;
    actionType = "";
    actionNote = "";
    resolveError = "";
  }

  async function submitResolve(e) {
    e.preventDefault();
    resolveError = "";
    if (!actionType) {
      resolveError = "Please select an action.";
      return;
    }
    resolveLoading = true;
    try {
      await api(`/api/moderation/reports/${resolvingReportId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ action_type: actionType, note: actionNote.trim() }),
      });
      closeResolve();
      await fetchReports();
    } catch (err) {
      resolveError = err.message || "Failed to resolve report.";
    } finally {
      resolveLoading = false;
    }
  }

  let hasNext = $derived(page * limit < total);
  let hasPrev = $derived(page > 1);
</script>

{#if loading}
  <div class="panel">
    <div class="panel-body" style="text-align:center;padding:40px;color:var(--text-muted)">
      Loading reports…
    </div>
  </div>
{:else if error}
  <div class="panel">
    <div class="panel-body" style="color:var(--orange)">{error}</div>
  </div>
{:else}
  <div class="panel">
    <div class="panel-header" style="display:flex;justify-content:space-between;align-items:center">
      <span>Moderation Reports</span>
      <span style="font-size:0.8rem;font-weight:400">{total} total</span>
    </div>
    <div class="panel-body" style="padding:0">
      <div class="filter-tabs">
        <button class:active={statusFilter === "pending"} onclick={() => { statusFilter = "pending"; page = 1; fetchReports(); }}>Pending</button>
        <button class:active={statusFilter === "resolved"} onclick={() => { statusFilter = "resolved"; page = 1; fetchReports(); }}
        >Resolved</button>
      </div>

      {#if reports.length === 0}
        <div style="padding:24px;text-align:center;color:var(--text-muted)">
          No {statusFilter} reports.
        </div>
      {:else}
        <div class="report-list">
          {#each reports as report (report.id)}
            <div class="report-row" class:resolved={report.status === "resolved"}>
              <div class="report-header">
                <span class="report-type">{report.targetType}</span>
                <span class="report-reason">{report.reason}</span>
                <span class="report-meta">by {report.reporterUsername}</span>
              </div>
              {#if report.details}
                <div class="report-details">{report.details}</div>
              {/if}
              <div class="report-footer">
                <span class="report-date">{new Date(report.createdAt).toLocaleString()}</span>
                {#if report.status === "pending"}
                  <button class="btn-primary" style="padding:4px 10px;font-size:0.75rem" onclick={() => openResolve(report.id)}>Resolve</button>
                {:else}
                  <span class="resolved-badge">Resolved</span>
                {/if}
              </div>

              {#if resolvingReportId === report.id}
                <form class="resolve-form" onsubmit={submitResolve}>
                  {#if resolveError}
                    <p class="form-error">{resolveError}</p>
                  {/if}
                  <div class="form-group">
                    <label for="resolve-action-{report.id}">Action</label>
                    <select id="resolve-action-{report.id}" bind:value={actionType}>
                      <option value="">Select action…</option>
                      {#each actions as a}
                        <option value={a.value}>{a.label}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="resolve-note-{report.id}">Note (optional)</label>
                    <textarea id="resolve-note-{report.id}" bind:value={actionNote} rows="2" placeholder="Internal note…"></textarea>
                  </div>
                  <div class="resolve-actions">
                    <button type="button" class="btn-secondary" onclick={closeResolve}>Cancel</button>
                    <button type="submit" class="btn-danger" disabled={resolveLoading}>
                      {resolveLoading ? "Resolving…" : "Confirm"}
                    </button>
                  </div>
                </form>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if total > limit}
        <div class="pagination" style="border-top:1px solid var(--border);margin-top:0;border-radius:0">
          <button disabled={!hasPrev} onclick={() => { page--; fetchReports(); }}>Previous</button>
          <span class="page-info">Page {page} of {Math.ceil(total / limit)}</span>
          <button disabled={!hasNext} onclick={() => { page++; fetchReports(); }}>Next</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .filter-tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    padding: 8px 12px 0;
    gap: 4px;
  }
  .filter-tabs button {
    background: none;
    border: none;
    padding: 6px 12px;
    font-size: 0.85rem;
    color: var(--text-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
  }
  .filter-tabs button.active {
    color: var(--orange);
    border-bottom-color: var(--orange);
    font-weight: 600;
  }
  .filter-tabs button:hover:not(.active) {
    color: var(--text);
  }
  .report-list {
    display: flex;
    flex-direction: column;
  }
  .report-row {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .report-row:last-child {
    border-bottom: none;
  }
  .report-row.resolved {
    background: #f8f8f8;
  }
  .report-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }
  .report-type {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--blue-light);
    color: var(--blue);
    padding: 2px 6px;
    border-radius: 3px;
  }
  .report-reason {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text);
  }
  .report-meta {
    font-size: 0.8rem;
    color: var(--text-meta);
  }
  .report-details {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 4px 0;
    white-space: pre-wrap;
  }
  .report-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
  }
  .report-date {
    font-size: 0.75rem;
    color: var(--text-meta);
  }
  .resolved-badge {
    font-size: 0.75rem;
    color: #16a34a;
    font-weight: 600;
  }
  .resolve-form {
    margin-top: 10px;
    padding: 12px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 3px;
  }
  .resolve-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 10px;
  }
</style>

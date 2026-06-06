<script>
  import { api } from "../lib/api.js";

  let { open = $bindable(false), targetType, targetId } = $props();

  const reasons = [
    "Spam",
    "Bots",
    "Harassment",
    "Doxxing",
    "Illegal content",
    "Coordinated abuse",
    "Other",
  ];

  let reason = $state("");
  let details = $state("");
  let loading = $state(false);
  let error = $state("");
  let success = $state(false);

  function close() {
    open = false;
    reason = "";
    details = "";
    error = "";
    success = false;
    loading = false;
  }

  async function submit(e) {
    e.preventDefault();
    error = "";
    if (!reason) {
      error = "Please select a reason.";
      return;
    }
    loading = true;
    try {
      await api("/api/moderation/report", {
        method: "POST",
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
          details: details.trim(),
        }),
      });
      success = true;
    } catch (err) {
      error = err.message || "Failed to submit report.";
    } finally {
      loading = false;
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={close} role="button" tabindex="0">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      {#if success}
        <div class="modal-body">
          <h3>Report submitted</h3>
          <p>Thank you. Your report has been sent to the moderation team.</p>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" onclick={close}>Close</button>
        </div>
      {:else}
        <form onsubmit={submit}>
          <div class="modal-body">
            <h3>Report {targetType}</h3>
            {#if error}
              <p class="form-error">{error}</p>
            {/if}
            <div class="form-group">
              <label for="report-reason">Reason</label>
              <select id="report-reason" bind:value={reason}>
                <option value="">Select a reason…</option>
                {#each reasons as r}
                  <option value={r}>{r}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label for="report-details">Details (optional)</label>
              <textarea
                id="report-details"
                bind:value={details}
                rows="3"
                placeholder="Any additional context…"
              ></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={close}>Cancel</button>
            <button type="submit" class="btn-danger" disabled={loading}>
              {loading ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    padding: 16px;
  }
  .modal {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 3px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
  .modal-body {
    padding: 16px;
  }
  .modal-body h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
  }
</style>

/**
 * manage_automations — Agent tool for listing and managing automations.
 *
 * Actions:
 * - list: List all automations for the current agent
 * - enable/disable: Toggle automation enabled state
 * - status: Get detailed status + recent history for an automation
 */

import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

interface ManageAutomationsInput {
  action: 'list' | 'enable' | 'disable' | 'status' | 'edit';
  automation_id?: string;
  updates?: { name?: string; cron?: string; prompt?: string; enabled?: boolean };
}

export async function handleManageAutomations(
  ctx: SessionToolContext,
  input: ManageAutomationsInput,
): Promise<ToolResult> {
  const { action, automation_id } = input;

  if (action === 'list') {
    if (!ctx.listAgentAutomations) {
      return errorResponse('Automation management is not available in this session (no skill linked).');
    }
    const automations = ctx.listAgentAutomations();
    if (automations.length === 0) {
      return successResponse('No automations configured for this agent.');
    }

    const lines = automations.map((a, i) => {
      const status = a.enabled ? '✓ enabled' : '✗ disabled';
      const schedule = a.cron ? ` | cron: ${a.cron}` : '';
      const lastRun = a.lastExecutedAt
        ? ` | last ran: ${formatRelativeTime(a.lastExecutedAt)}`
        : '';
      return `${i + 1}. "${a.name}" [${status}]${schedule}${lastRun}\n   Event: ${a.event} | Source: ${a.source} | ID: ${a.id}`;
    });

    return successResponse(`Automations for this agent:\n\n${lines.join('\n\n')}`);
  }

  if (action === 'enable' || action === 'disable') {
    if (!automation_id) {
      return errorResponse('automation_id is required for enable/disable actions.');
    }
    if (!ctx.setAutomationEnabled) {
      return errorResponse('Automation management is not available in this session.');
    }

    const enabled = action === 'enable';
    const result = await ctx.setAutomationEnabled(automation_id, enabled);
    if (!result.ok) {
      return errorResponse(`Failed to ${action} automation: ${result.error ?? 'Unknown error'}`);
    }
    return successResponse(`Automation "${automation_id}" has been ${enabled ? 'enabled' : 'disabled'}.`);
  }

  if (action === 'status') {
    if (!automation_id) {
      return errorResponse('automation_id is required for status action.');
    }

    // Get the automation details from the list
    const automations = ctx.listAgentAutomations?.() ?? [];
    const automation = automations.find(a => a.id === automation_id);
    if (!automation) {
      return errorResponse(`Automation "${automation_id}" not found. Use action "list" to see available automations.`);
    }

    let output = `Automation: "${automation.name}"\n`;
    output += `Status: ${automation.enabled ? 'enabled' : 'disabled'}\n`;
    output += `Event: ${automation.event}\n`;
    output += `Source: ${automation.source}\n`;
    if (automation.cron) output += `Schedule: ${automation.cron}\n`;
    if (automation.lastExecutedAt) output += `Last ran: ${formatRelativeTime(automation.lastExecutedAt)}\n`;

    // Get recent history
    if (ctx.getAutomationHistory) {
      const history = await ctx.getAutomationHistory(automation_id, 5);
      if (history.length > 0) {
        output += `\nRecent executions:\n`;
        for (const entry of history) {
          const time = new Date(entry.ts).toISOString();
          const status = entry.ok ? '✓' : '✗';
          const detail = entry.error ? ` — ${entry.error}` : (entry.prompt ? ` — ${entry.prompt.slice(0, 80)}...` : '');
          output += `  ${status} ${time}${detail}\n`;
        }
      } else {
        output += '\nNo execution history available.';
      }
    }

    return successResponse(output);
  }

  if (action === 'edit') {
    if (!automation_id) {
      return errorResponse('automation_id is required for edit action.');
    }
    if (!input.updates || Object.keys(input.updates).length === 0) {
      return errorResponse('updates object is required for edit action. Editable fields: name, cron, prompt, enabled.');
    }
    if (!ctx.editAutomation) {
      return errorResponse('Automation editing is not available in this session.');
    }

    const result = await ctx.editAutomation(automation_id, input.updates);
    if (!result.ok) {
      return errorResponse(`Failed to edit automation: ${result.error ?? 'Unknown error'}`);
    }

    const changed = Object.entries(input.updates)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : v}`)
      .join(', ');
    return successResponse(`Automation "${automation_id}" updated successfully. Changed: ${changed}`);
  }

  return errorResponse(`Unknown action: ${action}. Valid actions: list, enable, disable, status, edit.`);
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

<script lang="ts">
	import type { EventColor } from '$lib/options/config/event-type-colors';

	type Props = {
		color: EventColor;
		label: string;
		mono?: boolean;
		minWidth?: string;
	};

	let { color, label, mono = false, minWidth = '' }: Props = $props();

	const STYLES: Record<EventColor, { fg: string; border: string; bg: string }> = {
		green:  { fg: '#1f6c3a', border: '#bce0c6', bg: '#eef7f1' },
		red:    { fg: '#9c2a2a', border: '#e8c8be', bg: '#fbebe7' },
		amber:  { fg: '#8a5e1c', border: '#e6d3a3', bg: '#fbf2dc' },
		orange: { fg: '#8b4a1f', border: '#e8c9af', bg: '#fbeadc' },
		blue:   { fg: '#1f4b8a', border: '#bccfe6', bg: '#eaf1fb' },
		purple: { fg: '#5c2f8a', border: '#d2bee6', bg: '#f1e7fb' },
		teal:   { fg: '#1f6e6a', border: '#bce0dd', bg: '#eaf6f4' },
		sky:    { fg: '#1f5c8a', border: '#bcd5e6', bg: '#eaf2fb' },
		cyan:   { fg: '#1f6e7a', border: '#bcdce0', bg: '#eaf5f7' },
		gray:   { fg: '#5e5645', border: 'var(--border)', bg: 'var(--bg)' }
	};

	const style = $derived(STYLES[color]);
</script>

<span
	class="chip"
	class:mono
	style:--chip-fg={style.fg}
	style:--chip-border={style.border}
	style:--chip-bg={style.bg}
	style:--chip-min-width={minWidth}
>
	{label}
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.1rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: lowercase;
		letter-spacing: 0.02em;
		color: var(--chip-fg);
		background: var(--chip-bg);
		border: 1px solid var(--chip-border);
		border-radius: 999px;
		min-width: var(--chip-min-width);
		line-height: 1.4;
	}
	.chip.mono {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		text-transform: none;
		letter-spacing: 0;
	}
</style>

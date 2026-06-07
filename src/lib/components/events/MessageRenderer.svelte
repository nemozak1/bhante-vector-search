<script lang="ts">
	import type {
		EventEntityRef,
		EventEntityType,
		EventMetadata
	} from '$lib/server/db/types/system-events';

	type Props = {
		message: string;
		metadata: EventMetadata | null;
	};

	let { message, metadata }: Props = $props();

	type Piece = { kind: 'text'; text: string } | { kind: 'link'; entity: EventEntityRef };

	const PLACEHOLDER_RE = /\{(\w+):(\d+)\}/g;

	function hrefFor(entity: EventEntityRef): string | null {
		switch (entity.type as EventEntityType) {
			case 'user':
				return `/admin/users/${entity.id}`;
			case 'feedback':
				return `/admin/feedback/${entity.id}`;
			case 'seminar':
				return `/seminars/${entity.id}`;
			default:
				return null;
		}
	}

	const pieces = $derived.by<Piece[]>(() => {
		if (!metadata) return [{ kind: 'text', text: message }];
		const tpl = metadata.messageTemplate;
		const entities = metadata.entities ?? [];
		const out: Piece[] = [];
		let lastIndex = 0;
		PLACEHOLDER_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = PLACEHOLDER_RE.exec(tpl)) !== null) {
			if (m.index > lastIndex) {
				out.push({ kind: 'text', text: tpl.slice(lastIndex, m.index) });
			}
			const [, type, idxStr] = m;
			const idx = parseInt(idxStr, 10);
			const entity = entities[idx];
			if (entity && entity.type === type) {
				out.push({ kind: 'link', entity });
			} else {
				// Fallback: placeholder with no matching entity — keep as-is text.
				out.push({ kind: 'text', text: m[0] });
			}
			lastIndex = m.index + m[0].length;
		}
		if (lastIndex < tpl.length) {
			out.push({ kind: 'text', text: tpl.slice(lastIndex) });
		}
		return out;
	});
</script>

<span class="msg">
	{#each pieces as piece, i (i)}
		{#if piece.kind === 'text'}{piece.text}{:else}
			{@const href = hrefFor(piece.entity)}
			{#if href}
				<a class="entity entity-{piece.entity.type}" {href}>{piece.entity.label}</a>
			{:else}
				<span class="entity entity-{piece.entity.type}">{piece.entity.label}</span>
			{/if}
		{/if}
	{/each}
</span>

<style>
	.msg {
		font-size: 0.88rem;
		line-height: 1.45;
	}
	.entity {
		font-weight: 500;
		color: var(--accent);
		text-decoration: none;
		border-bottom: 1px dotted var(--accent);
		padding-bottom: 1px;
	}
	.entity:hover {
		color: var(--accent-hover);
		border-bottom-style: solid;
	}
	.entity-user {
		color: var(--book-accent);
		border-bottom-color: var(--book-accent);
	}
	.entity-user:hover {
		color: var(--book-accent);
	}
	.entity-seminar {
		color: var(--seminar-accent);
		border-bottom-color: var(--seminar-accent);
	}
	.entity-seminar:hover {
		color: var(--seminar-accent);
	}
</style>

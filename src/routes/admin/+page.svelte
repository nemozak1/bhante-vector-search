<script lang="ts">
	import { MessageSquareWarning, Users, Database, Activity, FileText, HeartPulse } from '@lucide/svelte';

	type Card = {
		href: string;
		label: string;
		blurb: string;
		icon: typeof MessageSquareWarning;
		live: boolean;
	};

	const cards: Card[] = [
		{
			href: '/admin/feedback',
			label: 'Feedback',
			blurb: 'Tester reports — bugs, seminar corrections, feature requests.',
			icon: MessageSquareWarning,
			live: true
		},
		{
			href: '/admin/review',
			label: 'Review',
			blurb: 'Seminar transcript cleanup status + diff between raw and cleaned.',
			icon: FileText,
			live: true
		},
		{
			href: '/admin/events',
			label: 'Activity',
			blurb: 'System events: auth, feedback triage, seminar ingests, errors.',
			icon: Activity,
			live: true
		},
		{
			href: '/admin/users',
			label: 'Users',
			blurb: 'List, promote / demote admins, drill into individual activity.',
			icon: Users,
			live: true
		},
		{
			href: '/admin/ingestion',
			label: 'Ingestion',
			blurb: 'Recent re-ingests, source SHA history, chunk counts per run.',
			icon: Database,
			live: true
		},
		{
			href: '/admin/health',
			label: 'Health',
			blurb: 'Chunk counts by collection, recent errors, integration status.',
			icon: HeartPulse,
			live: true
		}
	];
</script>

<section class="grid">
	{#each cards as card (card.href)}
		{#if card.live}
			<a class="card live" href={card.href}>
				<card.icon size={20} />
				<div>
					<h2>{card.label}</h2>
					<p>{card.blurb}</p>
				</div>
			</a>
		{:else}
			<div class="card placeholder">
				<card.icon size={20} />
				<div>
					<h2>{card.label} <span class="soon">soon</span></h2>
					<p>{card.blurb}</p>
				</div>
			</div>
		{/if}
	{/each}
</section>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}
	.card {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		padding: 1rem 1.1rem;
		background: var(--surface);
		border: 1px solid var(--border-light);
		border-radius: 4px;
		text-decoration: none;
		color: var(--text);
		transition: border-color 0.15s, transform 0.15s;
	}
	.card.live:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
	}
	.card.placeholder {
		opacity: 0.55;
	}
	.card h2 {
		margin: 0 0 0.25rem;
		font-family: 'Cormorant Garamond', serif;
		font-weight: 500;
		font-size: 1.1rem;
	}
	.card p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.4;
	}
	.soon {
		font-family: 'Source Sans 3', sans-serif;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		font-weight: 600;
		padding: 0.1rem 0.4rem;
		background: var(--border-light);
		border-radius: 999px;
		vertical-align: middle;
		margin-left: 0.4rem;
	}
</style>

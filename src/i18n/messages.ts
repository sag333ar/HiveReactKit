/**
 * Built-in UI label translations for hive-react-kit components.
 *
 * Keys follow the dotted convention `area.label`. Each language is a
 * flat Record<string, string>. Consumers can extend or override specific
 * keys via the `messages` prop on `<HiveLanguageProvider>`:
 *
 * ```tsx
 * <HiveLanguageProvider
 *   language="es"
 *   messages={{ es: { "action.follow": "Suivre" } }}
 * />
 * ```
 *
 * Missing keys for a non-English language fall back to the English entry,
 * which is the source of truth for every label.
 */

export type KitMessageKey =
  // Tabs
  | "tab.blogs" | "tab.posts" | "tab.snaps" | "tab.polls"
  | "tab.comments" | "tab.replies" | "tab.activities"
  | "tab.authorRewards" | "tab.curationRewards" | "tab.growth"
  | "tab.followers" | "tab.following" | "tab.wallet"
  | "tab.votingPower" | "tab.badges" | "tab.witnessVotes"
  // Profile meta
  | "meta.followers" | "meta.following" | "meta.posts"
  // Action menu
  | "action.follow" | "action.unfollow" | "action.ignoreAuthor"
  | "action.reportUser" | "action.shareProfile"
  | "action.cancel" | "action.confirmIgnore" | "action.processing"
  // Confirmation modals
  | "modal.ignoreAuthorTitle" | "modal.ignoreAuthorBody"
  // Empty states
  | "empty.noBlogs" | "empty.noPosts" | "empty.noSnaps" | "empty.noPolls"
  | "empty.noComments" | "empty.noReplies" | "empty.noFollowers"
  | "empty.notFollowing" | "empty.noBadges" | "empty.noWitnessVotes"
  | "empty.noPendingAuthor" | "empty.noPendingCuration" | "empty.curationHint"
  | "empty.votingPowerUnavailable" | "empty.userNotFound"
  // Status / poll
  | "status.active" | "status.ended"
  | "poll.selectAnOption" | "poll.selectUpTo" | "poll.changeYourVote"
  | "poll.selected" | "poll.submitVote" | "poll.submitVotes"
  | "poll.changeVote" | "poll.submitting" | "poll.voted"
  | "poll.voteChangesAllowed" | "poll.voter" | "poll.voters"
  | "poll.option" | "poll.options" | "poll.endsIn"
  // Common
  | "common.translating" | "common.processing" | "common.fullyCharged"
  // Reward summaries
  | "reward.pendingAuthor" | "reward.pendingCuration"
  | "reward.posts" | "reward.comments" | "reward.totalHbd"
  | "reward.totalHp" | "reward.avgEfficiency"
  | "reward.post" | "reward.comment"
  // Voting power labels
  | "vp.upvotePower" | "vp.downvotePower" | "vp.resourceCredits";

export type KitMessages = Partial<Record<KitMessageKey, string>>;

const en: Record<KitMessageKey, string> = {
  // Tabs
  "tab.blogs": "Blogs",
  "tab.posts": "Posts",
  "tab.snaps": "Snaps",
  "tab.polls": "Polls",
  "tab.comments": "Comments",
  "tab.replies": "Replies",
  "tab.activities": "Activities",
  "tab.authorRewards": "Author Rewards",
  "tab.curationRewards": "Curation Rewards",
  "tab.growth": "Growth",
  "tab.followers": "Followers",
  "tab.following": "Following",
  "tab.wallet": "Wallet",
  "tab.votingPower": "Voting Power",
  "tab.badges": "Badges",
  "tab.witnessVotes": "Witness Votes",

  // Profile meta
  "meta.followers": "Followers",
  "meta.following": "Following",
  "meta.posts": "Posts",

  // Action menu
  "action.follow": "Follow",
  "action.unfollow": "Unfollow",
  "action.ignoreAuthor": "Ignore Author",
  "action.reportUser": "Report User",
  "action.shareProfile": "Share Profile",
  "action.cancel": "Cancel",
  "action.confirmIgnore": "Confirm Ignore",
  "action.processing": "Processing…",

  // Confirmation modals — {username} is replaced at call site
  "modal.ignoreAuthorTitle": "Ignore Author",
  "modal.ignoreAuthorBody":
    "Are you sure you want to ignore @{username}? Their content will be hidden from your feed.",

  // Empty states
  "empty.noBlogs": "No blogs found",
  "empty.noPosts": "No posts found",
  "empty.noSnaps": "No snaps found",
  "empty.noPolls": "No polls found",
  "empty.noComments": "No comments found",
  "empty.noReplies": "No replies found",
  "empty.noFollowers": "No followers found",
  "empty.notFollowing": "Not following anyone",
  "empty.noBadges": "No badges found",
  "empty.noWitnessVotes": "No witness votes found",
  "empty.noPendingAuthor": "No pending author rewards",
  "empty.noPendingCuration": "No pending curation rewards",
  "empty.curationHint": "Rewards appear for posts you voted on with pending payouts",
  "empty.votingPowerUnavailable": "Voting power data unavailable",
  "empty.userNotFound": "User not found",

  // Status / poll
  "status.active": "Active",
  "status.ended": "Ended",
  "poll.selectAnOption": "Select an option",
  "poll.selectUpTo": "Select up to {count} option(s)",
  "poll.changeYourVote": "Change your vote — ",
  "poll.selected": "{count} selected",
  "poll.submitVote": "Submit Vote",
  "poll.submitVotes": "Submit Votes",
  "poll.changeVote": "Change Vote",
  "poll.submitting": "Submitting…",
  "poll.voted": "✓ Voted",
  "poll.voteChangesAllowed": "Vote changes allowed",
  "poll.voter": "voter",
  "poll.voters": "voters",
  "poll.option": "option",
  "poll.options": "options",
  "poll.endsIn": "Ends {when}",

  // Common
  "common.translating": "Translating…",
  "common.processing": "Processing…",
  "common.fullyCharged": "Fully charged",

  // Reward summaries
  "reward.pendingAuthor": "Pending Author Rewards",
  "reward.pendingCuration": "Pending Curation Rewards",
  "reward.posts": "Posts",
  "reward.comments": "Comments",
  "reward.totalHbd": "Total HBD",
  "reward.totalHp": "Total HP",
  "reward.avgEfficiency": "Avg Efficiency",
  "reward.post": "Post",
  "reward.comment": "Comment",

  // Voting power
  "vp.upvotePower": "Voting Power",
  "vp.downvotePower": "Downvote Power",
  "vp.resourceCredits": "Resource Credits",
};

const es: Record<KitMessageKey, string> = {
  // Tabs
  "tab.blogs": "Blogs",
  "tab.posts": "Publicaciones",
  "tab.snaps": "Snaps",
  "tab.polls": "Encuestas",
  "tab.comments": "Comentarios",
  "tab.replies": "Respuestas",
  "tab.activities": "Actividad",
  "tab.authorRewards": "Recompensas de autor",
  "tab.curationRewards": "Recompensas de curación",
  "tab.growth": "Crecimiento",
  "tab.followers": "Seguidores",
  "tab.following": "Siguiendo",
  "tab.wallet": "Cartera",
  "tab.votingPower": "Poder de voto",
  "tab.badges": "Insignias",
  "tab.witnessVotes": "Votos de testigo",

  // Profile meta
  "meta.followers": "Seguidores",
  "meta.following": "Siguiendo",
  "meta.posts": "Publicaciones",

  // Action menu
  "action.follow": "Seguir",
  "action.unfollow": "Dejar de seguir",
  "action.ignoreAuthor": "Ignorar autor",
  "action.reportUser": "Reportar usuario",
  "action.shareProfile": "Compartir perfil",
  "action.cancel": "Cancelar",
  "action.confirmIgnore": "Confirmar ignorar",
  "action.processing": "Procesando…",

  // Confirmation modals
  "modal.ignoreAuthorTitle": "Ignorar autor",
  "modal.ignoreAuthorBody":
    "¿Seguro que quieres ignorar a @{username}? Su contenido se ocultará de tu feed.",

  // Empty states
  "empty.noBlogs": "No se encontraron blogs",
  "empty.noPosts": "No se encontraron publicaciones",
  "empty.noSnaps": "No se encontraron snaps",
  "empty.noPolls": "No se encontraron encuestas",
  "empty.noComments": "No se encontraron comentarios",
  "empty.noReplies": "No se encontraron respuestas",
  "empty.noFollowers": "No tiene seguidores",
  "empty.notFollowing": "No sigue a nadie",
  "empty.noBadges": "No se encontraron insignias",
  "empty.noWitnessVotes": "No hay votos de testigo",
  "empty.noPendingAuthor": "No hay recompensas de autor pendientes",
  "empty.noPendingCuration": "No hay recompensas de curación pendientes",
  "empty.curationHint":
    "Las recompensas aparecen para las publicaciones que has votado con pagos pendientes",
  "empty.votingPowerUnavailable": "Datos de poder de voto no disponibles",
  "empty.userNotFound": "Usuario no encontrado",

  // Status / poll
  "status.active": "Activa",
  "status.ended": "Finalizada",
  "poll.selectAnOption": "Selecciona una opción",
  "poll.selectUpTo": "Selecciona hasta {count} opción(es)",
  "poll.changeYourVote": "Cambia tu voto — ",
  "poll.selected": "{count} seleccionada(s)",
  "poll.submitVote": "Enviar voto",
  "poll.submitVotes": "Enviar votos",
  "poll.changeVote": "Cambiar voto",
  "poll.submitting": "Enviando…",
  "poll.voted": "✓ Votado",
  "poll.voteChangesAllowed": "Cambios de voto permitidos",
  "poll.voter": "votante",
  "poll.voters": "votantes",
  "poll.option": "opción",
  "poll.options": "opciones",
  "poll.endsIn": "Termina {when}",

  // Common
  "common.translating": "Traduciendo…",
  "common.processing": "Procesando…",
  "common.fullyCharged": "Carga completa",

  // Reward summaries
  "reward.pendingAuthor": "Recompensas de autor pendientes",
  "reward.pendingCuration": "Recompensas de curación pendientes",
  "reward.posts": "Publicaciones",
  "reward.comments": "Comentarios",
  "reward.totalHbd": "HBD total",
  "reward.totalHp": "HP total",
  "reward.avgEfficiency": "Eficiencia media",
  "reward.post": "Publicación",
  "reward.comment": "Comentario",

  // Voting power
  "vp.upvotePower": "Poder de voto",
  "vp.downvotePower": "Poder de voto negativo",
  "vp.resourceCredits": "Créditos de recursos",
};

export const BUILTIN_MESSAGES: Record<string, Record<string, string>> = {
  en,
  es,
};

/**
 * Format helper — replaces `{key}` placeholders with the corresponding
 * value from `vars`. Missing vars leave the placeholder intact.
 */
export function formatMessage(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    return v == null ? `{${k}}` : String(v);
  });
}

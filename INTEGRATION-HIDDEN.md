# Architecture & Integration — statut : MASQUÉ (client admin)

La page existe et fonctionne (`src/pages/client-admin/ArchitectureDiagram.tsx`,
route `/client-admin/architecture` conservée dans `App.tsx`), mais l'entrée de
navigation est volontairement retirée du menu **Client Admin** le temps de la
mise en vitrine commerciale.

## Comment la remettre en ligne (1 ligne)

Dans `src/components/Layout.tsx`, section `user?.role === 'client_admin'`,
juste après le commentaire `// "Architecture & Integration" hidden for now…`,
ajouter l'entrée :

```tsx
{ to: '/client-admin/architecture', icon: Network, label: 'System Architecture' },
```

Aucune autre modification nécessaire :
- la route `/client-admin/architecture` est déjà déclarée dans `App.tsx` ;
- le composant lit les données réelles via l'API ou le mode démo ;
- le lien direct `https://…/#/client-admin/architecture` (ou `/client-admin/architecture` en history mode) fonctionne **déjà** pour ceux qui le connaissent — seul le menu ne l'affiche pas.

## Notes
- La vue Platform Admin des intégrations (`/admin/integrations`) reste visible :
  seule la vue client final a été masquée.
- Pour masquer aussi la route côté client : remplacer la ligne de route par
  `<Navigate to="/client-admin/dashboard" replace />` dans `App.tsx`.

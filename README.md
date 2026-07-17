# Omnigestion

<div align="center">

**ERP multi-tenant SaaS + Site vitrine e-commerce pour PME (Afrique de l'Ouest, FCFA)**

Next.js 16 (frontend) · AdonisJS 7 (backend) · PostgreSQL

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![AdonisJS](https://img.shields.io/badge/AdonisJS-7-5a45ff?style=flat-square&logo=adonisjs)](https://adonisjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)

</div>

---

## 📋 Sommaire

- [Présentation](#-présentation)
- [Stack technique](#-stack-technique)
- [Prérequis](#-prérequis)
- [Démarrage — Backend (AdonisJS)](#-démarrage--backend-adonisjs)
- [Démarrage — Frontend (Next.js)](#-démarrage--frontend-nextjs)
- [Scripts](#-scripts)
- [Structure du projet](#-structure-du-projet)
- [Multi-tenant & sécurité](#-multi-tenant--sécurité)
- [Module Analyse IA](#-module-analyse-ia)
- [Tests](#-tests)
- [Déploiement](#-déploiement)
- [Licence](#-licence)

---

## 📖 Présentation

Omnigestion est un système de gestion d'entreprise complet, hébergé en mode **SaaS multi-tenant**. Migration depuis Firebase terminée — l'application repose désormais sur une API AdonisJS + PostgreSQL.

### ERP (espace marchand, authentifié)

- **Tableau de bord** — KPIs (CA encaissé, bénéfices, crédits, stock), graphes de tendance, alertes.
- **Ventes** — factures multi-articles, TVA/remise, 4 moyens de paiement (espèces, Mobile Money, banque, crédit), annulation réversible, édition, impression reçus.
- **Stock** — produits multi-dépôts, mouvements (approvisionnement, transfert, perte), alertes rupture/stock faible, import/export Excel.
- **Caisse** — entrées/sorties, transferts entre caisses, solde temps réel.
- **Crédits** — créances clients et dettes fournisseurs, paiements partiels, suivi de l'encours.
- **Achats** — commandes fournisseurs, impact sur la dette fournisseur.
- **Clientèle & Fournisseurs** — bases de données, historique.
- **Rapports** — ventes, bénéfices (reconnaissance de marge), exports.
- **Paramètres** — entreprise, facturation, stock, utilisateurs/permissions, système, vitrine.
- **Analyse IA** — rapport de gestion généré depuis les indicateurs de la période (DeepSeek).

### Site vitrine e-commerce (public)

Chaque entreprise dispose d'une **boutique publique** personnalisable (`/store/[slug]`) :
- **4 templates** radicalement différents (Minimal, Boutique, Marché, Studio) + customizer (couleurs, polices, hero, sections, footer).
- **Commerce** : comptes acheteurs, fiche produit, panier, checkout (crée une **vraie facture ERP** `channel=store`), avis produits.

---

## 🛠 Stack technique

### Frontend (`/`)
- **Next.js 16** (App Router) · **React 19** · **TypeScript 5**
- **Tailwind CSS v4** + **shadcn/ui** + Radix
- **React Query** (data fetching) · **Zustand** · **React Hook Form + Zod**
- **Chart.js** (graphes) · **xlsx** (imports/exports) · **next-themes** (dark mode)
- **next/font** (Fraunces, polices variables)

### Backend (`/backend`)
- **AdonisJS 7** (kit API) · **TypeScript 6**
- **Lucid** (ORM) · **VineJS** (validation) · **@adonisjs/auth** (tokens d'accès)
- **@adonisjs/cors** · **@adonisjs/session** · **@adonisjs/shield**
- **pg** (PostgreSQL driver)

### Base de données
- **PostgreSQL 18** — schéma **multi-tenant** : `tenant_id` + `company_id` sur toute table métier, isolation par scopage applicatif.
- Argent en **`BIGINT`** (FCFA, zéro décimale), items de facture/achat normalisés (FK), stock multi-dépôt normalisé.

---

## 📦 Prérequis

- **Node.js 20+**
- **PostgreSQL 14+** (une base pour le dev, ex. `omnigestion_dev`)
- **npm**

---

## 🚀 Démarrage — Backend (AdonisJS)

```bash
cd backend
cp .env.example .env            # puis renseigner APP_KEY + DB_* (voir ci-dessous)
npm install
node ace migration:run          # créer le schéma (~61 migrations)
npm run dev                     # http://localhost:3333 (node ace serve --hmr)
```

### Variables d'environnement (`backend/.env`, voir `.env.example`)

| Variable | Rôle |
|---|---|
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | port HTTP (défaut `3333`) |
| `HOST` | hôte (défaut `localhost`) |
| `APP_KEY` | **secret fort** — générer via `node ace generate:key` |
| `APP_URL` / `LOG_LEVEL` / `SESSION_DRIVER` | app, logs, session (`cookie`) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_DATABASE` | connexion PostgreSQL |

> ⚠️ **Sécurité prod** : le `SecurityCheckProvider` bloque le démarrage en production si `APP_KEY` est faible ou `DB_PASSWORD='root'`. En `development`, pas de blocage.

---

## 🚀 Démarrage — Frontend (Next.js)

```bash
# à la racine du repo
npm install
```

Créer `.env.local` :

```env
NEXT_PUBLIC_API_URL=http://localhost:3333
```

> Optionnel (clés côté client) : **Cloudinary** pour les médias, **DeepSeek** pour le module Analyse IA.

```bash
npm run dev                     # http://localhost:3000
```

---

## 📜 Scripts

### Frontend (racine)

| Script | Action |
|---|---|
| `npm run dev` | Serveur de développement Next |
| `npm run build` | Build de production |
| `npm run start` | Démarrer le serveur de production |
| `npm run lint` | ESLint |
| `npm run generate-icons` | Régénérer les icônes PWA |

### Backend (`backend/`)

| Script / commande | Action |
|---|---|
| `npm run dev` | `node ace serve --hmr` (dev avec hot-reload) |
| `npm run build` | `node ace build` (compile vers `build/`) |
| `npm run start` | `node bin/server.js` (prod, après `build`) |
| `npm test` | `node ace test` (Japa) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `node ace migration:run` | Appliquer les migrations |
| `node ace generate:key` | Générer un `APP_KEY` |

---

## 🗂 Structure du projet

```
omnigestion/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # login, register, forgot-password
│   ├── (dashboard)/              # ERP (protégé)
│   │   ├── dashboard/            #   tableau de bord
│   │   ├── sales/                #   ventes + impression reçus
│   │   ├── stock/                #   produits + mouvements
│   │   ├── cash/                 #   caisse
│   │   ├── clients/  credits/    #   clientèle, créances
│   │   ├── suppliers/            #   fournisseurs + achats
│   │   ├── reports/              #   rapports (ventes, bénéfices)
│   │   ├── settings/             #   paramètres (entreprise, users, vitrine…)
│   │   └── analyse-ia/           #   rapport IA
│   └── store/[slug]/             # vitrine publique + produit + panier/checkout
├── components/                   # UI shadcn, ERP, storefront (4 templates)
├── lib/
│   ├── api/                      # client fetch + hooks React Query
│   ├── ai/                       # Analyse IA (report-data, report-prompt, deepseek)
│   ├── auth-context.tsx          # AuthProvider
│   ├── storefront/               # contexts acheteur + panier
│   └── hooks/                    # usePermissions, useInvoiceTotals…
├── public/                       # manifest.json, sw.js, icons/
├── types/                        # types TypeScript partagés
└── backend/                      # API AdonisJS
    ├── app/
    │   ├── controllers/          # un par module
    │   ├── models/               # CompanyScopedModel (multi-tenant)
    │   ├── services/             # InvoiceService, StockService, CashService,
    │   │                         #   CreditService, PurchaseService, ProfitService…
    │   ├── validators/           # VineJS
    │   ├── middleware/           # auth, tenancy, permission, throttle
    │   └── utils/                # invoice_totals, etc.
    ├── database/migrations/      # ~61 migrations
    ├── providers/                # security_check_provider (garde-fou prod)
    └── start/routes.ts           # /auth, /account, business (auth+tenancy), /public/*
```

---

## 🔐 Multi-tenant & sécurité

- **Hiérarchie** : `tenant` (compte SaaS) → `companies` (entreprises, N par tenant) → données métier scopées `tenant_id` + `company_id`.
- **Scopage automatique** : `CompanyScopedModel.forContext(ctx)` filtre toutes les requêtes par tenant + company (hook `before:create` remplit les colonnes).
- **Rôles** : le **owner** (`is_owner=true`) a un accès implicite à toutes ses companies ; les **employés** ont des permissions granulaires par module/action via `company_memberships`.
- **Auth** : tokens d'accès (30 j) **+ cookie HttpOnly** `omnigestion_token` ; le frontend utilise `credentials: 'include'`.
- **Transactions atomiques** sur les flux critiques : création / édition / annulation de facture (stock + caisse + crédits + stats client en une transaction, verrous `FOR UPDATE`).
- **Rate-limiting** sur les endpoints d'auth publics (throttle middleware).

---

## 🤖 Module Analyse IA

Génère un **rapport de gestion** Markdown à partir des indicateurs agrégés de la période (modèle DeepSeek, clé côté client).

- `lib/ai/report-data.ts` — compile les KPIs (CA vendu HT, coût, marge, cash collecté, stock, crédits, top produits/clients).
- `lib/ai/report-prompt.ts` — construit le prompt envoyé au modèle.

> 💡 Le **CA vendu (HT)** est le chiffre d'affaires (base facturation). Les **encaissements** (cash collecté, dont remboursements de crédits) sont affichés séparément et peuvent différer fortement du CA vendu — ils ne doivent pas être confondus.

---

## 🧪 Tests

```bash
cd backend && npm test            # Japa — ventes, stock, caisse, crédits, achats, isolation multi-tenant…
```

---

## 🚢 Déploiement

Production sur VPS Hetzner (`168.119.119.4`) : frontend `:3001`, backend `:3334`, PostgreSQL + systemd.

- **Backend** :
  ```bash
  npm run build
  cd build && npm ci --omit=dev && node bin/server.js
  ```
- **Frontend** :
  ```bash
  npm run build && npm run start    # derrière un reverse proxy
  ```

---

## 📝 Licence

Propriétaire — Tous droits réservés © 2026.

<div align="center">

**Conçu pour les PME d'Afrique de l'Ouest** 🌍

</div>

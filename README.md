# Omnigestion

<div align="center">

**Système de gestion d'entreprise complet pour PME**

Application web moderne et offline-first pour gérer les ventes, le stock, la caisse, les clients et les fournisseurs.

[![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Latest-ffca28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Enabled-5a0fc8?style=flat-square&logo=pwa)](https://www.pwabuilder.com/)

</div>

---

## 📋 Table des matières

- [Fonctionnalités](#-fonctionnalités)
- [Technologies](#-technologies)
- [Prérequis](#-prérequis)
- [Installation](️-installation)
- [Configuration](#-configuration)
- [Développement](#-développement)
- [Déploiement](️-déploiement)
- [Structure du projet](#-structure-du-projet)
- [Contributing](#-contributing)
- [Licence](#-licence)

---

## ✨ Fonctionnalités

### Core Modules

- **📊 Tableau de bord** - Vue d'ensemble avec KPIs et statistiques
- **💰 Ventes** - Création de factures, gestion des paiements, crédits clients
- **📦 Stock** - Gestion des produits, inventaire, alertes de stock bas
- **💵 Caisse** - Entrées/sorties, transferts entre caisses
- **👥 Clientèle** - Base de données clients, historique d'achat
- **💳 Crédits** - Suivi des créances clients et dettes fournisseurs
- **🏭 Fournisseurs** - Gestion du parc fournisseurs
- **📈 Rapports** - Analytics, export de données

### Technical Features

- **🌐 Offline-First** - Fonctionne sans connexion internet
- **📱 PWA** - Installable comme application native
- **🔐 Authentification** - Firebase Auth avec rôles (Admin/Employé)
- **🎨 Design System** - UI cohérente avec dark mode
- **⚡ Performance** - Optimisé Next.js 15 avec App Router
- **🔄 Sync** - Synchronisation automatique des données

---

## 🛠 Technologies

### Frontend
- **Framework**: Next.js 15+ (App Router)
- **Langage**: TypeScript 5+
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Context + Hooks
- **Forms**: React Hook Form + Zod

### Backend & Database
- **BaaS**: Firebase (Firestore, Auth)
- **Cache**: IndexedDB (Dexie.js)
- **Storage**: Firebase Storage

### DevOps
- **Hosting**: Vercel
- **CI/CD**: GitHub Actions
- **Quality**: ESLint, Prettier

---

## 📦 Prérequis

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** ou **yarn** ou **pnpm**
- **Firebase Project** ([Create free](https://console.firebase.google.com/))

---

## 🚀 Installation

### 1. Cloner le repository

```bash
git clone https://github.com/votre-organisation/omnigestion.git
cd omnigestion
```

### 2. Installer les dépendances

```bash
npm install
# ou
yarn install
# ou
pnpm install
```

### 3. Configuration Firebase

Créez un fichier `.env.local` à la racine :

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firestore Measurement ID (optionnel)
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

Pour obtenir ces valeurs :

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Créez un nouveau projet
3. Activez **Firestore Database** et **Authentication**
4. Allez dans **Project Settings** → **General** → **Your apps**
5. Copiez les valeurs dans `.env.local`

### 4. Initialiser Firestore

Créez les collections et indexes nécessaires :

```bash
npm run firebase:init
```

Ou manuellement dans Firebase Console :

- Collection `companies`
- Collection `users`
- Collection `products`
- Collection `customers`
- Collection `suppliers`
- Collection `sales`
- Collection `cashTransactions`

---

## 💻 Développement

### Démarrer le serveur de développement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

### Scripts disponibles

```bash
# Développement
npm run dev          # Démarrer le serveur de développement

# Build
npm run build        # Créer une production build
npm run start        # Démarrer le serveur de production

# Qualité
npm run lint         # Linter avec ESLint
npm run type-check   # Vérifier les types TypeScript

# Tests (à implémenter)
npm run test         # Lancer les tests
npm run test:watch   # Mode watch
```

### Structure des dossiers

```
omnigestion/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Routes d'authentification
│   ├── (dashboard)/       # Routes protégées
│   ├── layout.tsx         # Layout racine
│   └── globals.css        # Styles globaux
├── components/            # Composants React
│   ├── ui/               # Composants shadcn/ui
│   ├── layouts/          # Layouts (Header, Sidebar)
│   ├── pwa/              # PWA components
│   └── ...
├── lib/                   # Utilitaires
│   ├── firebase/         # Configuration Firebase
│   ├── hooks/            # Custom React hooks
│   └── utils.ts          # Fonctions utilitaires
├── public/               # Assets statiques
│   ├── manifest.json     # PWA manifest
│   ├── sw.js            # Service Worker
│   └── icons/           # PWA icons
└── types/               # Types TypeScript
```

---

## 🚢 Déploiement

### Vercel (Recommandé)

1. Push le code sur GitHub
2. Importer le projet sur [Vercel](https://vercel.com)
3. Ajouter les variables d'environnement
4. Déployer

```bash
npm run build
vercel --prod
```

### Build manuel

```bash
# Build
npm run build

# Tester la production
npm run start
```

### Configuration PWA

Le manifest PWA est généré automatiquement. Pour personnaliser :

1. Modifiez `public/manifest.json`
2. Mettez à jour `app/layout.tsx` (metadata)
3. Regénérez les icônes dans `public/icons/`

---

## 📁 Structure du projet

### Architecture

```
┌─────────────────────────────────────────┐
│            Next.js 15 App               │
├─────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────────┐ │
│  │   App Router │  │  React Context  │ │
│  └──────────────┘  └─────────────────┘ │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ shadcn/ui    │  │  Firebase       │ │
│  │ Components   │  │  Firestore      │ │
│  └──────────────┘  └─────────────────┘ │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │  Service     │  │  IndexedDB      │ │
│  │  Worker      │  │  (Offline)      │ │
│  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────┘
```

### Design System

Voir documentation complète :

- **Palette de couleurs**: Noir/blanc avec accent violet
- **Typographie**: Geist Sans + Geist Mono
- **Composants**: shadcn/ui
- **Dark mode**: Support natif

---

## 🤝 Contributing

Les contributions sont les bienvenues !

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

### Guidelines

- Suivez le code style existant
- Ajoutez des tests si possible
- Mettez à jour la documentation
- Respectez les conventions de commit

---

## 📝 Licence

Ce projet est sous licence proprietary - Tous droits réservés © 2025

---

## 📞 Support

Pour toute question ou support :

- 📧 Email: support@omnigestion.com
- 🐛 Issues: [GitHub Issues](https://github.com/votre-organisation/omnigestion/issues)

---

## 🙏 Remerciements

- **Next.js** - Framework React
- **shadcn/ui** - Composants UI
- **Firebase** - Backend-as-a-Service
- **Tailwind CSS** - Framework CSS
- **Lucide** - Icones

---

<div align="center">

**Conçu avec ❤️ pour les PME africaines**

[⬆ Retour au sommet](#omnigestion)

</div>

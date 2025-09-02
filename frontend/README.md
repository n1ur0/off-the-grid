# Off the Grid Frontend

Next.js 14 web application for decentralized grid trading on the Ergo blockchain.

## Features

- **Nautilus Wallet Integration**: Official EIP-12 protocol support
- **Interactive Education**: Learn grid trading concepts before trading
- **Real-time Updates**: WebSocket integration for live trading data
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Type Safety**: Full TypeScript implementation

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Wallet**: Nautilus (EIP-12)
- **UI Components**: Headless UI, Heroicons
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 8+
- Nautilus wallet browser extension

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
npm run test         # Run tests
npm run test:e2e     # Run E2E tests
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication pages
│   ├── learn/             # Educational modules
│   ├── dashboard/         # Trading dashboard
│   └── trade/             # Grid configuration
├── components/            # React components
│   ├── wallet/            # Wallet integration
│   ├── education/         # Learning modules
│   ├── trading/           # Trading interface
│   └── ui/                # Shared UI components
├── lib/                   # Utilities and services
│   ├── stores/            # Zustand stores
│   ├── api.ts             # API client
│   └── wallet.ts          # Wallet manager
└── types/                 # TypeScript definitions
    ├── wallet.ts          # Wallet types
    ├── trading.ts         # Trading types
    └── api.ts             # API types
```

## Configuration

### Environment Variables

See `.env.local.example` for all available environment variables.

Key variables:
- `NEXT_PUBLIC_API_URL`: FastAPI backend URL
- `NEXT_PUBLIC_WS_URL`: WebSocket server URL

### Nautilus Wallet Setup

1. Install [Nautilus Wallet Extension](https://chrome.google.com/webstore/detail/nautilus/gjlmehlldlphhljhpnlddaodbjjcchai)
2. Create or import an Ergo wallet
3. Connect to the application

## Development

### Code Style

- Use TypeScript for all new files
- Follow ESLint configuration
- Use Prettier for formatting
- Implement proper error handling
- Add JSDoc comments for complex functions

### Testing

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

## Deployment

```bash
# Build production version
npm run build

# Start production server
npm start
```

## Contributing

1. Follow the existing code patterns
2. Add tests for new features
3. Update documentation
4. Ensure TypeScript types are properly defined
5. Test wallet integration thoroughly
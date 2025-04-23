# Reactive Graph Frontend

This project is a React application that visualizes data as a graph. It utilizes TypeScript for type safety and Vite as the build tool for a fast development experience.

## Project Structure

```
reactive-graph-frontend
├── public
│   └── index.html          # Main HTML file serving as the entry point
├── src
│   ├── components
│   │   └── GraphVisualizer.tsx  # Component for rendering graph visualizations
│   ├── hooks
│   │   └── useGraphData.ts      # Custom hook for fetching and managing graph data
│   ├── types
│   │   └── index.ts             # TypeScript types and interfaces
│   ├── App.tsx                  # Main application component
│   └── main.tsx                 # Entry point for the React application
├── package.json                  # npm configuration file
├── tsconfig.json                 # TypeScript configuration file
├── vite.config.ts                # Vite configuration file
└── README.md                     # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd reactive-graph-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000` (or the port specified in the Vite config) to view the application.

## Usage

- The `GraphVisualizer` component is responsible for rendering the graph based on the data provided to it.
- The `useGraphData` hook manages the fetching and state of the graph data, making it available to components that need it.
- TypeScript types are defined in the `types` directory to ensure type safety throughout the application.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.
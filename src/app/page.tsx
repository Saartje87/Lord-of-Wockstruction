import { GameLoader } from "./game-loader";

/**
 * The Loading Screen is drawn here, by the page itself, so it shows at first
 * paint, before the game bundle has downloaded. The game fills its bar and
 * shows a failure on it (`src/game/loadingScreen.ts`).
 */
export default function Home() {
  return (
    <>
      <div id="loading-screen" className="loading-screen">
        <h1 className="loading-title">Lord of Wockstruction</h1>
        <div
          id="loading-bar"
          className="loading-bar"
          role="progressbar"
          aria-label="Loading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <div id="loading-fill" className="loading-fill" />
        </div>
        <p id="loading-message" className="loading-message" hidden>
          The 3D World failed to load.
        </p>
        <button
          id="loading-retry"
          className="loading-retry"
          type="button"
          hidden
        >
          Retry
        </button>
      </div>
      <GameLoader />
    </>
  );
}

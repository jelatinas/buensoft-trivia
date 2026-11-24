import React, { useEffect, useState } from "react";
import { AdminPanel } from "./components/admin/AdminPanel";
import { LoginView } from "./components/LoginView";
import { MainMenu } from "./components/MainMenu";
import { MpHub } from "./components/multiplayer/MpHub";
import { MpRoom } from "./components/multiplayer/MpRoom";
import { SoloGame } from "./components/solo/SoloGame";
import { SoloSetup } from "./components/solo/SoloSetup";
import { SoloSummary } from "./components/solo/SoloSummary";
import { StatsView } from "./components/stats/StatsView";
import { DEFAULT_BOT_IDS, type BotMatchState } from "./lib/aiOpponents";
import {
  checkTriviaSchemaInstalled,
  listCategories,
  redeemWorkspaceCode,
  startSoloGame
} from "./services/triviaApi";
import type {
  Category,
  MpRoomState,
  SoloConfig,
  SoloGameState,
  Student
} from "./types/trivia";

type Screen =
  | "login"
  | "menu"
  | "solo_setup"
  | "solo_game"
  | "solo_summary"
  | "mp_hub"
  | "mp_room"
  | "stats"
  | "admin";

const STORAGE_KEY = "buensoft-trivia-student";

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>("login");
  const [student, setStudent] = useState<Student | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [schemaReady, setSchemaReady] = useState<boolean>(true);

  const [lastSoloConfig, setLastSoloConfig] = useState<SoloConfig | undefined>(undefined);
  const [soloState, setSoloState] = useState<SoloGameState | null>(null);
  const [soloFinalBots, setSoloFinalBots] = useState<BotMatchState[]>([]);
  const [soloUnlocked, setSoloUnlocked] = useState<Array<{ code: string; title: string }>>([]);
  const [soloStarting, setSoloStarting] = useState(false);
  const [soloError, setSoloError] = useState<string | null>(null);

  const [mpRoom, setMpRoom] = useState<MpRoomState | null>(null);

  async function refreshCatalog() {
    const [ready, cats] = await Promise.all([
      checkTriviaSchemaInstalled(),
      listCategories().catch(() => [] as Category[])
    ]);
    setSchemaReady(ready);
    setCategories(cats);
  }

  useEffect(() => {
    void refreshCatalog();

    // Soporte de entrada automática desde Buensoft Workspace (?entrada=...)
    const params = new URLSearchParams(window.location.search);
    const code = params.get("entrada");
    if (code && /^[A-Za-z0-9_-]{20,}$/.test(code)) {
      params.delete("entrada");
      const q = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (q ? `?${q}` : "") + window.location.hash
      );
      redeemWorkspaceCode(code)
        .then((s) => handleLogin(s))
        .catch(() => {});
      return;
    }

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Student;
        if (parsed?.id && parsed?.name) {
          setStudent(parsed);
          setScreen("menu");
        }
      }
    } catch {
      // ignorar
    }
  }, []);

  function handleLogin(s: Student) {
    setStudent(s);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // ignorar
    }
    setScreen("menu");
    void refreshCatalog();
  }

  function handleLogout() {
    setStudent(null);
    setSoloState(null);
    setSoloFinalBots([]);
    setMpRoom(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignorar
    }
    setScreen("login");
  }

  async function handleStartSolo(config: SoloConfig, customQuestionIds?: string[]) {
    if (!student) return;
    setSoloStarting(true);
    setSoloError(null);
    setLastSoloConfig(config);
    try {
      const game = await startSoloGame(student.id, config, customQuestionIds);
      setSoloState(game);
      setSoloFinalBots([]);
      setSoloUnlocked([]);
      setScreen("solo_game");
    } catch (err) {
      setSoloError(err instanceof Error ? err.message : "No se pudo iniciar la partida SOLO.");
      setScreen("solo_setup");
    } finally {
      setSoloStarting(false);
    }
  }

  if (!student || screen === "login") {
    return <LoginView onLogin={handleLogin} />;
  }

  if (screen === "solo_setup") {
    return (
      <SoloSetup
        categories={categories}
        initialConfig={lastSoloConfig}
        loading={soloStarting}
        error={soloError}
        onStart={(cfg) => void handleStartSolo(cfg)}
        onBack={() => setScreen("menu")}
      />
    );
  }

  if (screen === "solo_game" && soloState) {
    return (
      <SoloGame
        student={student}
        initialState={soloState}
        botIds={lastSoloConfig?.botIds ?? DEFAULT_BOT_IDS}
        onFinished={(finalState, unlocked, finalBots) => {
          setSoloState(finalState);
          setSoloUnlocked(unlocked);
          setSoloFinalBots(finalBots);
          setScreen("solo_summary");
        }}
        onExit={() => {
          setSoloState(null);
          setScreen("menu");
        }}
      />
    );
  }

  if (screen === "solo_summary" && soloState) {
    return (
      <SoloSummary
        student={student}
        state={soloState}
        bots={soloFinalBots}
        newlyUnlocked={soloUnlocked}
        onPlayAgain={() => {
          if (lastSoloConfig) {
            void handleStartSolo(lastSoloConfig);
          } else {
            setScreen("solo_setup");
          }
        }}
        onPracticeMissed={(questionIds) => {
          const practiceCfg: SoloConfig = {
            mode: "practica",
            totalRounds: 3,
            questionsPerRound: 15,
            timeLimitSec: 15,
            subjectIds: [],
            difficulty: "mixta",
            lifelinesEnabled: false,
            botIds: []
          };
          void handleStartSolo(practiceCfg, questionIds);
        }}
        onChangeCategory={() => setScreen("solo_setup")}
        onMainMenu={() => setScreen("menu")}
      />
    );
  }

  if (screen === "mp_hub") {
    return (
      <MpHub
        student={student}
        categories={categories}
        onEnterRoom={(room) => {
          setMpRoom(room);
          setScreen("mp_room");
        }}
        onBack={() => setScreen("menu")}
      />
    );
  }

  if (screen === "mp_room" && mpRoom) {
    return (
      <MpRoom
        student={student}
        initialRoom={mpRoom}
        onExit={() => {
          setMpRoom(null);
          setScreen("menu");
        }}
      />
    );
  }

  if (screen === "stats") {
    return <StatsView student={student} onBack={() => setScreen("menu")} />;
  }

  if (screen === "admin") {
    return (
      <AdminPanel
        categories={categories}
        schemaReady={schemaReady}
        onRefreshCategories={refreshCatalog}
        onBack={() => setScreen("menu")}
      />
    );
  }

  return (
    <MainMenu
      student={student}
      categories={categories}
      schemaReady={schemaReady}
      onSelectSolo={() => {
        setSoloError(null);
        setScreen("solo_setup");
      }}
      onSelectMultiplayer={() => setScreen("mp_hub")}
      onOpenStats={() => setScreen("stats")}
      onOpenAdmin={() => setScreen("admin")}
      onLogout={handleLogout}
    />
  );
};

export default App;

import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import {
    BOARD_SIZE,
    PLAYERS,
    PLAYER_COLOR,
    PLAYER_LABEL,
    PIECE_SYMBOL,
} from "./src/game/constants.js";
import { createInitialBoard, isPlayable, keyOf } from "./src/game/board.js";
import { chooseRobotMove } from "./src/game/bot.js";
import { applyMove, createCapturesBy } from "./src/game/engine.js";
import { isLegalMove } from "./src/game/rules.js";
import { computeStats } from "./src/game/stats.js";
import {
    colorOfPlayer,
    createPerspectiveCells,
    firstHumanColor,
    freeSeatsOf,
    parseRemoteState,
} from "./src/game/view.js";
import {
    clearPlayerStatus,
    createRemoteGame,
    deleteRemoteGame,
    fetchPlayerStatus,
    fetchRemoteGame,
    getAuthenticatedUserId,
    joinRemoteGame,
    listJoinableGames,
    isRemoteGameNotFoundError,
    subscribeRemoteGame,
    supabaseConfigured,
    syncRemoteGame,
    upsertPlayerStatus,
} from "./src/lib/gameApi.js";
import { normalizeUsername } from "./src/lib/username.js";
import { getTabUsername, setTabUsername } from "./src/lib/tabUsername.js";
import {
    clearLocalSession,
    loadLocalSession,
    saveLocalSession,
    setActiveLocalUsername,
} from "./src/lib/localSession.js";

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export default function App() {
    const { width, height } = useWindowDimensions();
    const [sidebarMeasuredWidth, setSidebarMeasuredWidth] = useState(0);
    const [board, setBoard] = useState(() => createInitialBoard());
    const [turn, setTurn] = useState("white");
    const [selected, setSelected] = useState(null);
    const [lastMove, setLastMove] = useState(null);
    const [moveCount, setMoveCount] = useState(0);
    const [capturesBy, setCapturesBy] = useState({
        ...createCapturesBy(),
    });
    const [isInGame, setIsInGame] = useState(false);
    const [playMode, setPlayMode] = useState("local");
    const [remoteGameId, setRemoteGameId] = useState(null);
    const [remotePlayerIds, setRemotePlayerIds] = useState({});
    const [isRemoteOwner, setIsRemoteOwner] = useState(false);
    const [localPlayerColor, setLocalPlayerColor] = useState("white");
    const [syncMessage, setSyncMessage] = useState("Remote: non synchronisé");
    const [waitingPlayersMessage, setWaitingPlayersMessage] = useState(null);
    const [joinColor, setJoinColor] = useState("white");
    const [joinableGames, setJoinableGames] = useState([]);
    const [selectedJoinGameId, setSelectedJoinGameId] = useState(null);
    const [loadingJoinableGames, setLoadingJoinableGames] = useState(false);
    const [hasSavedLocalGame, setHasSavedLocalGame] = useState(false);
    const [remoteUpdatedAt, setRemoteUpdatedAt] = useState(null);
    const remoteUpdatedAtRef = useRef(null);
    const hasAutoResumedLocalRef = useRef(false);
    const [controlByColor, setControlByColor] = useState({
        white: "human",
        red: "human",
        black: "human",
        blue: "human",
    });
    const [playerUsername, setPlayerUsername] = useState(() => getTabUsername());
    const normalizedPlayerUsername = normalizeUsername(playerUsername, "player");

    const isCompactLayout = width < 980;
    const isSmallScreen = width < 700;
    const effectiveSidebarWidth = isCompactLayout ? 0 : sidebarMeasuredWidth;
    const shortSide = Math.min(width, height);
    const stageWidth = Math.max(width - effectiveSidebarWidth, 220);
    const scorePanelWidth = clamp(Math.floor(stageWidth * 0.18), 108, 180);
    const boardPixelSize = Math.floor(Math.min(stageWidth - 20, height - 20));
    const renderedBoardSize = Math.floor(
        clamp(
            boardPixelSize,
            196,
            900,
        ),
    );
    const squareSize = Math.floor(renderedBoardSize / BOARD_SIZE);
    const boardSize = squareSize * BOARD_SIZE;
    const menuShortSide = isCompactLayout
        ? Math.min(width, 420)
        : Math.min(Math.max(sidebarMeasuredWidth, 180), height);

    const panelHorizontalPadding = clamp(Math.floor(shortSide * 0.018), 10, 18);
    const panelVerticalPadding = clamp(Math.floor(shortSide * 0.016), 8, 16);
    const panelRadius = clamp(Math.floor(shortSide * 0.02), 8, 14);

    const menuScale = isSmallScreen ? 0.84 : 1;
    const titleFontSize = clamp(Math.floor(shortSide * 0.027 * menuScale), 10, 18);
    const valueFontSize = clamp(Math.floor(shortSide * 0.032 * menuScale), 12, 21);
    const subFontSize = clamp(Math.floor(shortSide * 0.022 * menuScale), 10, 15);
    const buttonFontSize = clamp(Math.floor(menuShortSide * 0.1 * menuScale), 9, 14);
    const pieceFontSize = clamp(Math.floor(squareSize * 0.72), 12, 40);

    const resetButtonVerticalPadding = clamp(
        Math.floor(menuShortSide * 0.06),
        6,
        10,
    );
    const resetButtonHorizontalPadding = clamp(
        Math.floor(menuShortSide * 0.06),
        8,
        14,
    );
    const lineSpacing = clamp(Math.floor(shortSide * 0.006), 3, 8);
    const stageGap = clamp(Math.floor(shortSide * 0.012), 6, 14);
    const useCompactInGameMenu = isSmallScreen && isInGame;

    const cells = useMemo(
        () => createPerspectiveCells(board, localPlayerColor),
        [board, localPlayerColor],
    );
    const legalTargets = useMemo(() => {
        if (!selected) {
            return new Set();
        }
        const piece = board[keyOf(selected.x, selected.y)];
        if (!piece || piece.player !== turn) {
            return new Set();
        }

        const targets = new Set();
        for (let y = 0; y < BOARD_SIZE; y += 1) {
            for (let x = 0; x < BOARD_SIZE; x += 1) {
                if (!isPlayable(x, y)) {
                    continue;
                }
                if (isLegalMove(board, selected.x, selected.y, x, y, piece)) {
                    targets.add(keyOf(x, y));
                }
            }
        }
        return targets;
    }, [board, selected, turn]);
    const stats = useMemo(
        () => computeStats(board, capturesBy),
        [board, capturesBy],
    );
    const alivePlayers = stats.filter((s) => s.alive).map((s) => s.player);
    const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
    const playerColorLabel = PLAYER_LABEL[localPlayerColor] ?? "Inconnue";
    const canResumeLocalGame = hasSavedLocalGame && !isInGame;

    useEffect(() => {
        remoteUpdatedAtRef.current = remoteUpdatedAt;
    }, [remoteUpdatedAt]);

    const persistPlayerPresence = async ({
        username = playerUsername,
        status = "idle",
        sessionMode = "local",
        currentGameId = null,
        currentColor = null,
        isOwner = false,
    } = {}) => {
        const normalizedUsername = normalizeUsername(username, "player");
        if (!supabaseConfigured) {
            return;
        }

        try {
            await upsertPlayerStatus({
                username: normalizedUsername,
                status,
                sessionMode,
                currentGameId,
                currentColor,
                isOwner,
            });
        } catch (error) {
            console.error("Remote player status persistence failed", error);
        }
    };

    const clearPlayerPresence = async () => {
        const normalizedUsername = normalizeUsername(playerUsername, "player");

        if (!supabaseConfigured) {
            return;
        }

        try {
            await clearPlayerStatus(normalizedUsername);
        } catch (error) {
            console.error("Remote player status cleanup failed", error);
        }
    };

    const getRequiredUsername = () => {
        const normalized = normalizeUsername(playerUsername, "");
        if (!normalized) {
            Alert.alert("Joueur", "Saisis un pseudo (lettres/chiffres/_/-).");
            return null;
        }
        if (normalized !== playerUsername) {
            setPlayerUsername(normalized);
        }
        setActiveLocalUsername(normalized);
        return normalized;
    };

    const selectOrMove = (x, y) => {
        if (!isInGame) {
            return;
        }
        if (playMode !== "local" && turn !== localPlayerColor) {
            return;
        }
        if (controlByColor[turn] === "robot") {
            return;
        }

        const squareKey = keyOf(x, y);
        const target = board[squareKey];

        if (!selected) {
            if (!target || target.player !== turn || winner) {
                return;
            }
            setSelected({ x, y });
            return;
        }

        if (selected.x === x && selected.y === y) {
            setSelected(null);
            return;
        }

        if (target && target.player === turn) {
            setSelected({ x, y });
            return;
        }

        const result = applyMove(
            {
                board,
                turn,
                moveCount,
                capturesBy,
                winner,
            },
            selected.x,
            selected.y,
            x,
            y,
        );

        if (!result.ok) {
            return;
        }

        setBoard(result.state.board);
        setCapturesBy(result.state.capturesBy);
        setTurn(result.state.turn);
        setMoveCount(result.state.moveCount);
        setLastMove({
            fromX: selected.x,
            fromY: selected.y,
            toX: x,
            toY: y,
        });
        setSelected(null);
        void syncLocalStateToRemote(result.state, "coup joueur");
    };

    const initializeGame = () => {
        setBoard(createInitialBoard());
        setTurn("white");
        setSelected(null);
        setLastMove(null);
        setMoveCount(0);
        setCapturesBy(createCapturesBy());
    };

    const applyGameState = (parsedState) => {
        setBoard(parsedState.board);
        setTurn(parsedState.turn);
        setMoveCount(parsedState.moveCount);
        setCapturesBy(parsedState.capturesBy);
        setLastMove(parsedState.lastMove ?? null);
        setSelected(null);
    };

    const resetToNoGame = () => {
        setIsInGame(false);
        setRemoteGameId(null);
        setRemotePlayerIds({});
        setRemoteUpdatedAt(null);
        setIsRemoteOwner(false);
        setLocalPlayerColor("white");
        initializeGame();
        setSyncMessage("Aucune partie en cours");
        setWaitingPlayersMessage(null);
        setSelected(null);
        setLastMove(null);
    };

    const startLocalGame = async () => {
        const username = getRequiredUsername();
        if (!username) {
            return;
        }
        initializeGame();
        setPlayMode("local");
        setRemoteGameId(null);
        setRemotePlayerIds({});
        setRemoteUpdatedAt(null);
        setIsRemoteOwner(false);
        const localColor = firstHumanColor(controlByColor);
        setLocalPlayerColor(localColor);
        setSyncMessage("Mode local");
        setWaitingPlayersMessage(null);
        setIsInGame(true);
        void persistPlayerPresence({
            username,
            status: "in_game",
            sessionMode: "local",
            currentColor: localColor,
            isOwner: false,
        });
    };

    const resumeSavedLocalGame = async () => {
        const username = getRequiredUsername();
        if (!username) {
            return;
        }
        const localSession = await loadLocalSession(username);
        const snapshot = localSession?.localGameState;
        if (
            !localSession ||
            localSession.status !== "in_game" ||
            localSession.sessionMode !== "local" ||
            !snapshot
        ) {
            Alert.alert("Reprise", "Aucune partie locale sauvegardée.");
            setHasSavedLocalGame(false);
            return;
        }

        applyGameState(snapshot);
        setControlByColor(snapshot.controlByColor);
        setPlayMode("local");
        setRemoteGameId(null);
        setRemotePlayerIds({});
        setRemoteUpdatedAt(null);
        setIsRemoteOwner(false);
        setLocalPlayerColor(localSession.currentColor ?? firstHumanColor(snapshot.controlByColor));
        setIsInGame(true);
        setSyncMessage(`Partie locale reprise (${username})`);
        setWaitingPlayersMessage(null);
        hasAutoResumedLocalRef.current = true;
    };

    const syncLocalStateToRemote = async (nextState, reason = "sync") => {
        if (!isInGame || playMode === "local" || !remoteGameId) {
            return;
        }

        try {
            const syncResult = await syncRemoteGame(remoteGameId, nextState);
            if (syncResult?.updated_at) {
                setRemoteUpdatedAt(syncResult.updated_at);
            }
            setSyncMessage(`Remote: ${reason} synchronisé`);
        } catch (error) {
            setSyncMessage(`Remote: échec ${reason}`);
            console.error("Remote sync failed", error);
        }
    };

    const loadJoinableGames = async () => {
        if (!supabaseConfigured) {
            return;
        }

        setLoadingJoinableGames(true);
        try {
            const games = await listJoinableGames();
            setJoinableGames(games);

            if (games.length === 0) {
                setSelectedJoinGameId(null);
            } else if (!games.some((game) => game.id === selectedJoinGameId)) {
                setSelectedJoinGameId(games[0].id);
            }
        } catch (error) {
            Alert.alert("Supabase", error.message);
        } finally {
            setLoadingJoinableGames(false);
        }
    };

    const onCreateRemote = async () => {
        const username = getRequiredUsername();
        if (!username) {
            return;
        }
        try {
            await getAuthenticatedUserId();
            const initialState = {
                board: createInitialBoard(),
                turn: "white",
                moveCount: 0,
                capturesBy: createCapturesBy(),
                winner: null,
            };
            const result = await createRemoteGame(initialState, {
                controlByColor,
            }, username);
            applyGameState(initialState);
            setRemoteGameId(result.id);
            setRemotePlayerIds(result.player_ids ?? {});
            setRemoteUpdatedAt(result.updated_at ?? null);
            setIsRemoteOwner(true);
            const localColor =
                colorOfPlayer(result.player_ids, normalizedPlayerUsername) ?? "white";
            setLocalPlayerColor(localColor);
            setIsInGame(true);
            setSyncMessage(
                `Remote: partie créée (${result.id.slice(0, 8)}...)`,
            );
            void persistPlayerPresence({
                username,
                status: "in_game",
                sessionMode: "remote_create",
                currentGameId: result.id,
                currentColor: localColor,
                isOwner: true,
            });
        } catch (error) {
            Alert.alert("Supabase", error.message);
        }
    };

    const onJoinRemote = async () => {
        const username = getRequiredUsername();
        if (!username) {
            return;
        }
        if (!selectedJoinGameId) {
            Alert.alert("Supabase", "Aucune partie disponible à rejoindre.");
            return;
        }

        try {
            await getAuthenticatedUserId();
            const freshRemote = await fetchRemoteGame(selectedJoinGameId);
            const freshFreeSeats = freeSeatsOf(freshRemote.player_ids);
            if (!freshFreeSeats.includes(joinColor)) {
                await loadJoinableGames();
                Alert.alert(
                    "Supabase",
                    "La couleur sélectionnée vient d'être prise. Choisis une autre couleur.",
                );
                return;
            }

            const result = await joinRemoteGame(
                selectedJoinGameId,
                joinColor,
                username,
            );
            setRemoteGameId(result.id);
            const remoteGame = await fetchRemoteGame(result.id);
            const parsed = parseRemoteState(remoteGame);
            setRemotePlayerIds(remoteGame.player_ids ?? {});
            const assignedColor =
                result.assigned_color ??
                colorOfPlayer(
                    remoteGame.player_ids,
                    normalizedPlayerUsername,
                ) ??
                joinColor;
            applyGameState(parsed);
            setRemoteUpdatedAt(remoteGame.updated_at ?? null);
            setIsRemoteOwner(false);
            setLocalPlayerColor(assignedColor);
            setJoinColor(assignedColor);
            setIsInGame(true);
            setSyncMessage(
                `Remote: inscrit en ${PLAYER_LABEL[assignedColor]} (${result.id.slice(0, 8)}...)`,
            );
            void persistPlayerPresence({
                username,
                status: "in_game",
                sessionMode: "remote_join",
                currentGameId: result.id,
                currentColor: assignedColor,
                isOwner: false,
            });
            await loadJoinableGames();
        } catch (error) {
            Alert.alert("Supabase", error.message);
        }
    };

    const setPlayerControl = (color, mode) => {
        setControlByColor((previous) => ({
            ...previous,
            [color]: mode,
        }));
    };

    const selectPlayMode = (nextMode) => {
        if (isInGame) {
            return;
        }
        setPlayMode(nextMode);
        setSyncMessage(nextMode === "local" ? "Mode local" : "Remote: non synchronisé");
    };

    const onQuitGame = async () => {
        const username = normalizeUsername(playerUsername, "player");
        if (remoteGameId && isRemoteOwner) {
            try {
                await deleteRemoteGame(remoteGameId);
            } catch (error) {
                Alert.alert("Supabase", error.message);
                return;
            }
        }

        if (playMode === "local") {
            try {
                await clearLocalSession(username);
                setHasSavedLocalGame(false);
            } catch (error) {
                console.error("Local session cleanup failed", error);
            }
        }

        resetToNoGame();
        void clearPlayerPresence();
    };

    const onSyncRemote = async () => {
        if (!remoteGameId) {
            Alert.alert(
                "Supabase",
                "Crée ou rejoins d'abord une partie distante.",
            );
            return;
        }
        try {
            await syncRemoteGame(remoteGameId, {
                board,
                turn,
                moveCount,
                capturesBy,
                winner,
            });
            setSyncMessage("Remote: synchronisation réussie");
        } catch (error) {
            Alert.alert("Supabase", error.message);
        }
    };

    const whiteStats = stats.find((s) => s.player === "white");
    const redStats = stats.find((s) => s.player === "red");
    const blackStats = stats.find((s) => s.player === "black");
    const blueStats = stats.find((s) => s.player === "blue");
    const selectedJoinGame =
        joinableGames.find((game) => game.id === selectedJoinGameId) ?? null;
    const selectedJoinGameFreeSeats = freeSeatsOf(selectedJoinGame?.player_ids);
    const canUseRemote = isInGame && playMode !== "local";

    useEffect(() => {
        setTabUsername(normalizedPlayerUsername);
        setActiveLocalUsername(normalizedPlayerUsername);
        hasAutoResumedLocalRef.current = false;
    }, [normalizedPlayerUsername]);

    useEffect(() => {
        if (isInGame) {
            return undefined;
        }

        let cancelled = false;

        const loadLocalSnapshot = async () => {
            const localSession = await loadLocalSession(normalizedPlayerUsername);
            if (cancelled) {
                return;
            }

            const hasSnapshot = Boolean(
                localSession?.status === "in_game" &&
                    localSession?.sessionMode === "local" &&
                    localSession?.localGameState,
            );
            setHasSavedLocalGame(hasSnapshot);

            if (!hasSnapshot || hasAutoResumedLocalRef.current) {
                return;
            }

            const snapshot = localSession.localGameState;
            applyGameState(snapshot);
            setControlByColor(snapshot.controlByColor);
            setPlayMode("local");
            setRemoteGameId(null);
            setRemoteUpdatedAt(null);
            setIsRemoteOwner(false);
            setLocalPlayerColor(
                localSession.currentColor ?? firstHumanColor(snapshot.controlByColor),
            );
            setIsInGame(true);
            setSyncMessage(`Partie locale restaurée (${normalizedPlayerUsername})`);
            hasAutoResumedLocalRef.current = true;
        };

        void loadLocalSnapshot();

        return () => {
            cancelled = true;
        };
    }, [normalizedPlayerUsername, isInGame]);

    useEffect(() => {
        if (!supabaseConfigured || isInGame || hasAutoResumedLocalRef.current) {
            return undefined;
        }

        const requestedUsername = normalizeUsername(playerUsername, "");
        if (!requestedUsername) {
            return undefined;
        }

        let cancelled = false;

        const applyStatus = async () => {
            try {
                const statusRow = await fetchPlayerStatus(requestedUsername);
                if (cancelled || hasAutoResumedLocalRef.current || !statusRow) {
                    return;
                }

                const sessionMode = statusRow.session_mode;
                const colorFromStatus = PLAYERS.includes(statusRow.current_color)
                    ? statusRow.current_color
                    : null;

                if (statusRow.status !== "in_game") {
                    setPlayMode(
                        sessionMode === "remote_create"
                            ? "create"
                            : sessionMode === "remote_join"
                                ? "join"
                                : "local",
                    );
                    if (colorFromStatus) {
                        setJoinColor(colorFromStatus);
                        setLocalPlayerColor(colorFromStatus);
                    }
                    setSyncMessage(`Statut chargé (${requestedUsername})`);
                    return;
                }

                if (sessionMode === "local") {
                    const localSession = await loadLocalSession(requestedUsername);
                    const snapshot = localSession?.localGameState;
                    if (snapshot) {
                        applyGameState(snapshot);
                        setControlByColor(snapshot.controlByColor);
                    } else {
                        initializeGame();
                    }
                    setPlayMode("local");
                    setRemoteGameId(null);
                    setRemotePlayerIds({});
                    setRemoteUpdatedAt(null);
                    setIsRemoteOwner(false);
                    setLocalPlayerColor(colorFromStatus ?? "white");
                    setIsInGame(true);
                    setSyncMessage(`Partie locale restaurée (${requestedUsername})`);
                    setWaitingPlayersMessage(null);
                    return;
                }

                const gameId = statusRow.current_game_id;
                if (!gameId) {
                    return;
                }

                const remoteGame = await fetchRemoteGame(gameId);
                if (cancelled) {
                    return;
                }
                const parsed = parseRemoteState(remoteGame);
                const resolvedColor =
                    colorFromStatus ??
                    colorOfPlayer(remoteGame.player_ids, requestedUsername) ??
                    "white";

                applyGameState(parsed);
                setPlayMode(sessionMode === "remote_create" ? "create" : "join");
                setRemoteGameId(gameId);
                setRemotePlayerIds(remoteGame.player_ids ?? {});
                setRemoteUpdatedAt(remoteGame.updated_at ?? null);
                setIsRemoteOwner(Boolean(statusRow.is_owner));
                setLocalPlayerColor(resolvedColor);
                setJoinColor(resolvedColor);
                setIsInGame(true);
                setSyncMessage(`Partie remote restaurée (${requestedUsername})`);
            } catch (error) {
                if (!cancelled) {
                    console.error("Player status restore failed", error);
                }
            }
        };

        void applyStatus();

        return () => {
            cancelled = true;
        };
    }, [playerUsername, normalizedPlayerUsername, supabaseConfigured, isInGame]);

    useEffect(() => {
        if (!isInGame || playMode !== "local") {
            return undefined;
        }

        const persistLocalSnapshot = async () => {
            try {
                await saveLocalSession({
                    username: normalizedPlayerUsername,
                    status: "in_game",
                    sessionMode: "local",
                    currentColor: localPlayerColor,
                    localGameState: {
                        board,
                        turn,
                        moveCount,
                        capturesBy,
                        winner,
                        controlByColor,
                    },
                });
                setHasSavedLocalGame(true);
            } catch (error) {
                console.error("Local session persistence failed", error);
            }
        };

        void persistLocalSnapshot();
        return undefined;
    }, [
        isInGame,
        playMode,
        normalizedPlayerUsername,
        localPlayerColor,
        board,
        turn,
        moveCount,
        capturesBy,
        winner,
        controlByColor,
    ]);

    useEffect(() => {
        if (!isInGame || winner || controlByColor[turn] !== "robot") {
            return undefined;
        }

        const timerId = setTimeout(() => {
            const botMove = chooseRobotMove({
                board,
                turn,
                moveCount,
                capturesBy,
                winner,
            });

            if (!botMove) {
                setSyncMessage(
                    `Robot ${PLAYER_LABEL[turn]}: aucun coup disponible`,
                );
                return;
            }

            const result = applyMove(
                {
                    board,
                    turn,
                    moveCount,
                    capturesBy,
                    winner,
                },
                botMove.fromX,
                botMove.fromY,
                botMove.toX,
                botMove.toY,
            );

            if (!result.ok) {
                setSyncMessage(
                    `Robot ${PLAYER_LABEL[turn]}: coup invalide (${result.reason})`,
                );
                return;
            }

            setBoard(result.state.board);
            setCapturesBy(result.state.capturesBy);
            setTurn(result.state.turn);
            setMoveCount(result.state.moveCount);
            setLastMove({
                fromX: botMove.fromX,
                fromY: botMove.fromY,
                toX: botMove.toX,
                toY: botMove.toY,
            });
            setSelected(null);
            void syncLocalStateToRemote(result.state, "coup robot");
            setSyncMessage(
                `Robot ${PLAYER_LABEL[turn]}: (${botMove.fromX},${botMove.fromY}) -> (${botMove.toX},${botMove.toY})`,
            );
        }, 500);

        return () => clearTimeout(timerId);
    }, [isInGame, board, turn, moveCount, capturesBy, winner, controlByColor]);

    useEffect(() => {
        if (isInGame || playMode !== "join" || !supabaseConfigured) {
            return undefined;
        }

        void loadJoinableGames();
        return undefined;
    }, [isInGame, playMode, supabaseConfigured]);

    useEffect(() => {
        if (!isInGame || playMode === "local" || !remoteGameId || !supabaseConfigured) {
            return undefined;
        }

        let cancelled = false;
        let unsubscribe = null;
        let pullIntervalId = null;

        const applyRemoteSnapshot = (remoteGame, source = "realtime") => {
            const nextUpdatedAt = remoteGame?.updated_at ?? null;
            const previousUpdatedAt = remoteUpdatedAtRef.current;
            if (
                nextUpdatedAt &&
                previousUpdatedAt &&
                nextUpdatedAt <= previousUpdatedAt
            ) {
                return;
            }

            const parsed = parseRemoteState(remoteGame);
            applyGameState(parsed);
            setRemotePlayerIds(remoteGame?.player_ids ?? {});
            setRemoteUpdatedAt(nextUpdatedAt);
            setSyncMessage(`Remote: mise à jour reçue (${source})`);
        };

        const pullInitialRemoteState = async () => {
            try {
                const remoteGame = await fetchRemoteGame(remoteGameId);
                if (cancelled) {
                    return;
                }

                applyRemoteSnapshot(remoteGame, "fetch");
            } catch (error) {
                if (!cancelled) {
                    if (isRemoteGameNotFoundError(error)) {
                        resetToNoGame();
                        setSyncMessage("Remote: partie supprimée");
                        void clearPlayerPresence();
                        return;
                    }
                    console.error("Remote pull failed", error);
                }
            }
        };

        void pullInitialRemoteState();
        pullIntervalId = setInterval(() => {
            void pullInitialRemoteState();
        }, 1200);

        try {
            unsubscribe = subscribeRemoteGame(remoteGameId, {
                onStatus: (status) => {
                    if (cancelled) {
                        return;
                    }
                    if (status === "SUBSCRIBED") {
                        setSyncMessage("Remote: abonnement temps réel actif");
                    } else if (
                        status === "CHANNEL_ERROR" ||
                        status === "TIMED_OUT" ||
                        status === "CLOSED"
                    ) {
                        setSyncMessage("Remote: fallback polling actif");
                    }
                },
                onChange: ({ eventType, row }) => {
                    if (cancelled) {
                        return;
                    }

                    if (eventType === "DELETE") {
                        resetToNoGame();
                        setSyncMessage("Remote: partie supprimée");
                        void clearPlayerPresence();
                        return;
                    }

                    if (eventType === "UPDATE" && row) {
                        applyRemoteSnapshot(row, "realtime");
                    }
                },
            });
        } catch (error) {
            console.error("Remote realtime subscribe failed", error);
        }

        return () => {
            cancelled = true;
            if (pullIntervalId) {
                clearInterval(pullIntervalId);
            }
            if (typeof unsubscribe === "function") {
                void unsubscribe();
            }
        };
    }, [isInGame, playMode, remoteGameId, supabaseConfigured]);

    useEffect(() => {
        if (!isInGame || playMode === "local" || !remoteGameId || !supabaseConfigured) {
            setWaitingPlayersMessage(null);
            return undefined;
        }

        let cancelled = false;
        let intervalId = null;

        const updateWaitingStatus = async () => {
            const missingSeats = PLAYERS.filter((color) => !remotePlayerIds[color]);
            if (missingSeats.length > 0) {
                if (!cancelled) {
                    setWaitingPlayersMessage(
                        `En attente de joueurs: ${4 - missingSeats.length}/4 sièges occupés`,
                    );
                }
                return;
            }

            const humanPlayers = Array.from(
                new Set(
                    Object.values(remotePlayerIds).filter(
                        (username) => Boolean(username) && username !== "robot",
                    ),
                ),
            );
            if (humanPlayers.length === 0) {
                if (!cancelled) {
                    setWaitingPlayersMessage(null);
                }
                return;
            }

            const statuses = await Promise.all(
                humanPlayers.map(async (username) => {
                    try {
                        return await fetchPlayerStatus(username);
                    } catch (error) {
                        return null;
                    }
                }),
            );

            if (cancelled) {
                return;
            }

            const disconnectedPlayers = humanPlayers.filter((username, index) => {
                const statusRow = statuses[index];
                return (
                    !statusRow ||
                    statusRow.status !== "in_game" ||
                    statusRow.current_game_id !== remoteGameId
                );
            });

            if (disconnectedPlayers.length > 0) {
                setWaitingPlayersMessage(
                    `En attente de joueurs: ${disconnectedPlayers.join(", ")}`,
                );
                return;
            }

            setWaitingPlayersMessage(null);
        };

        void updateWaitingStatus();
        intervalId = setInterval(() => {
            void updateWaitingStatus();
        }, 5000);

        return () => {
            cancelled = true;
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isInGame, playMode, remoteGameId, supabaseConfigured, remotePlayerIds]);

    return (
        <SafeAreaView style={styles.page}>
            <StatusBar style="light" />
            <View
                style={[
                    styles.layoutRoot,
                    { flexDirection: isCompactLayout ? "column" : "row" },
                ]}
            >
                <View
                    onLayout={(event) => {
                        const nextWidth = Math.floor(event.nativeEvent.layout.width);
                        if (nextWidth > 0 && nextWidth !== sidebarMeasuredWidth) {
                            setSidebarMeasuredWidth(nextWidth);
                        }
                    }}
                    style={[
                        styles.sidebar,
                        {
                            maxWidth: isCompactLayout
                                ? Math.min(width, isSmallScreen ? 420 : width)
                                : Math.floor(width * 0.45),
                            padding: isSmallScreen
                                ? Math.max(6, panelVerticalPadding - 3)
                                : panelVerticalPadding,
                            gap: stageGap,
                            borderRightWidth: isCompactLayout ? 0 : 1,
                            borderBottomWidth: isCompactLayout ? 1 : 0,
                            borderBottomColor: "rgba(255, 255, 255, 0.12)",
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.menuPanel,
                            {
                                borderRadius: panelRadius,
                                paddingHorizontal: panelHorizontalPadding,
                                paddingVertical: panelVerticalPadding,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.cornerTitle,
                                { fontSize: titleFontSize },
                            ]}
                        >
                            Menu
                        </Text>
                        <Text
                            style={[
                                styles.cornerValue,
                                {
                                    fontSize: valueFontSize,
                                    marginTop: lineSpacing,
                                },
                            ]}
                        >
                            {winner
                                ? `Gagnant: ${PLAYER_LABEL[winner]}`
                                : PLAYER_LABEL[turn]}
                        </Text>
                        {useCompactInGameMenu ? (
                            <Text
                                style={[
                                    styles.cornerSub,
                                    {
                                        fontSize: subFontSize,
                                        marginTop: lineSpacing,
                                    },
                                ]}
                            >
                                {normalizedPlayerUsername} | {playerColorLabel} | {moveCount} coups
                            </Text>
                        ) : (
                            <>
                                <Text
                                    style={[
                                        styles.cornerSub,
                                        {
                                            fontSize: subFontSize,
                                            marginTop: lineSpacing,
                                        },
                                    ]}
                                >
                                    Joueur: {normalizedPlayerUsername}
                                </Text>
                                <Text
                                    style={[
                                        styles.cornerSub,
                                        {
                                            fontSize: subFontSize,
                                            marginTop: lineSpacing,
                                        },
                                    ]}
                                >
                                    Ma couleur: {playerColorLabel}
                                </Text>
                                <Text
                                    style={[
                                        styles.cornerSub,
                                        {
                                            fontSize: subFontSize,
                                            marginTop: lineSpacing,
                                        },
                                    ]}
                                >
                                    Coups: {moveCount}
                                </Text>
                            </>
                        )}
                        {!isInGame ? (
                            <>
                                <Text
                                    style={[
                                        styles.cornerSub,
                                        {
                                            fontSize: subFontSize,
                                            marginTop: lineSpacing * 2,
                                        },
                                    ]}
                                >
                                    Mode de jeu
                                </Text>
                                <Text
                                    style={[
                                        styles.cornerSub,
                                        {
                                            fontSize: subFontSize,
                                            marginTop: lineSpacing * 2,
                                        },
                                    ]}
                                >
                                    Nom du joueur
                                </Text>
                                <TextInput
                                    style={[
                                        styles.usernameInput,
                                        {
                                            marginTop: lineSpacing,
                                        },
                                    ]}
                                    value={playerUsername}
                                    onChangeText={(text) => {
                                        setPlayerUsername(text);
                                    }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    maxLength={32}
                                    placeholder="ex: alice"
                                    placeholderTextColor="#94a3b8"
                                />
                                <View
                                    style={[
                                        styles.visibilityRow,
                                        {
                                            marginTop: lineSpacing,
                                            gap: lineSpacing,
                                            flexWrap: isSmallScreen ? "wrap" : "nowrap",
                                        },
                                    ]}
                                >
                                    <Pressable
                                        style={[
                                            styles.visibilityButton,
                                            playMode === "local"
                                                ? styles.visibilityButtonActive
                                                : null,
                                        ]}
                                        onPress={() => selectPlayMode("local")}
                                    >
                                        <Text style={styles.visibilityText}>
                                            {isSmallScreen ? "⌂ Local" : "Local"}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[
                                            styles.visibilityButton,
                                            playMode === "create"
                                                ? styles.visibilityButtonActive
                                                : null,
                                        ]}
                                        onPress={() => selectPlayMode("create")}
                                    >
                                        <Text style={styles.visibilityText}>
                                            {isSmallScreen ? "＋ Créer" : "Créer remote"}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[
                                            styles.visibilityButton,
                                            playMode === "join"
                                                ? styles.visibilityButtonActive
                                                : null,
                                        ]}
                                        onPress={() => selectPlayMode("join")}
                                    >
                                        <Text style={styles.visibilityText}>
                                            {isSmallScreen ? "↔ Rejoindre" : "Rejoindre remote"}
                                        </Text>
                                    </Pressable>
                                </View>

                                {playMode !== "join" ? (
                                    <>
                                        <Text
                                            style={[
                                                styles.cornerSub,
                                                {
                                                    fontSize: subFontSize,
                                                    marginTop: lineSpacing * 2,
                                                },
                                            ]}
                                        >
                                            Type des sièges
                                        </Text>
                                        {PLAYERS.map((color) => (
                                            <View
                                                key={`${color}-control`}
                                                style={[
                                                    styles.playerInputRow,
                                                    { marginTop: lineSpacing },
                                                ]}
                                            >
                                                <Text style={styles.playerInputLabel}>
                                                    {PLAYER_LABEL[color]}
                                                </Text>
                                                <View style={styles.playerControlRow}>
                                                    <Pressable
                                                        style={[
                                                            styles.controlButton,
                                                            controlByColor[color] === "human"
                                                                ? styles.controlButtonActive
                                                                : null,
                                                        ]}
                                                        onPress={() =>
                                                            setPlayerControl(color, "human")
                                                        }
                                                    >
                                                        <Text style={styles.controlButtonText}>
                                                            Humain
                                                        </Text>
                                                    </Pressable>
                                                    <Pressable
                                                        style={[
                                                            styles.controlButton,
                                                            controlByColor[color] === "robot"
                                                                ? styles.controlButtonActive
                                                                : null,
                                                        ]}
                                                        onPress={() =>
                                                            setPlayerControl(color, "robot")
                                                        }
                                                    >
                                                        <Text style={styles.controlButtonText}>
                                                            Robot
                                                        </Text>
                                                    </Pressable>
                                                </View>
                                            </View>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <Text
                                            style={[
                                                styles.cornerSub,
                                                {
                                                    fontSize: subFontSize,
                                                    marginTop: lineSpacing * 2,
                                                },
                                            ]}
                                        >
                                            Parties disponibles
                                        </Text>
                                        <View
                                            style={[
                                                styles.joinableGamesContainer,
                                                { marginTop: lineSpacing, gap: lineSpacing },
                                            ]}
                                        >
                                            {joinableGames.map((game) => {
                                                const freeSeats = freeSeatsOf(game.player_ids);
                                                return (
                                                    <Pressable
                                                        key={game.id}
                                                        style={[
                                                            styles.joinableGameButton,
                                                            selectedJoinGameId === game.id
                                                                ? styles.visibilityButtonActive
                                                                : null,
                                                        ]}
                                                        onPress={() =>
                                                            setSelectedJoinGameId(game.id)
                                                        }
                                                    >
                                                        <Text style={styles.joinableGameTitle}>
                                                            {game.id.slice(0, 8)}...
                                                        </Text>
                                                        <Text style={styles.joinableGameSub}>
                                                            Places libres:{" "}
                                                            {freeSeats
                                                                .map(
                                                                    (color) =>
                                                                        PLAYER_LABEL[color],
                                                                )
                                                                .join(", ")}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                            {joinableGames.length === 0 ? (
                                                <Text style={styles.cornerSub}>
                                                    Aucune partie joignable.
                                                </Text>
                                            ) : null}
                                            <Pressable
                                                style={styles.refreshJoinablesButton}
                                                onPress={loadJoinableGames}
                                            >
                                                <Text style={styles.resetText}>
                                                    {loadingJoinableGames
                                                        ? "Chargement..."
                                                        : "Rafraîchir la liste"}
                                                </Text>
                                            </Pressable>
                                        </View>
                                        <Text
                                            style={[
                                                styles.cornerSub,
                                                {
                                                    fontSize: subFontSize,
                                                    marginTop: lineSpacing * 2,
                                                },
                                            ]}
                                        >
                                            Couleur à rejoindre
                                        </Text>
                                        <View
                                            style={[
                                                styles.visibilityRow,
                                                {
                                                    marginTop: lineSpacing,
                                                    gap: lineSpacing,
                                                    flexWrap: "wrap",
                                                },
                                            ]}
                                        >
                                            {PLAYERS.map((color) => {
                                                const isSeatFree =
                                                    selectedJoinGameFreeSeats.includes(
                                                        color,
                                                    );
                                                return (
                                                    <Pressable
                                                        key={`join-${color}`}
                                                        style={[
                                                            styles.joinColorButton,
                                                            joinColor === color
                                                                ? styles.visibilityButtonActive
                                                                : null,
                                                            !isSeatFree
                                                                ? styles.joinColorButtonDisabled
                                                                : null,
                                                        ]}
                                                        onPress={() => {
                                                            if (isSeatFree) {
                                                                setJoinColor(color);
                                                            }
                                                        }}
                                                    >
                                                        <Text style={styles.visibilityText}>
                                                            {PLAYER_LABEL[color]}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </>
                                )}

                                <Pressable
                                    style={[
                                        styles.menuButtonSecondary,
                                        {
                                            marginTop: lineSpacing * 2,
                                            paddingVertical: resetButtonVerticalPadding,
                                            paddingHorizontal:
                                                resetButtonHorizontalPadding,
                                            borderRadius: clamp(
                                                Math.floor(panelRadius * 0.7),
                                                5,
                                                10,
                                            ),
                                            opacity: canResumeLocalGame ? 1 : 0.45,
                                        },
                                    ]}
                                    onPress={resumeSavedLocalGame}
                                    disabled={!canResumeLocalGame}
                                >
                                        <Text
                                            style={[
                                                styles.resetText,
                                                { fontSize: buttonFontSize },
                                            ]}
                                        >
                                        {isSmallScreen
                                            ? "↺ Reprendre locale"
                                            : "Reprendre partie locale"}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={[
                                        styles.menuButtonSecondary,
                                        {
                                            marginTop: lineSpacing * 2,
                                            paddingVertical: resetButtonVerticalPadding,
                                            paddingHorizontal:
                                                resetButtonHorizontalPadding,
                                            borderRadius: clamp(
                                                Math.floor(panelRadius * 0.7),
                                                5,
                                                10,
                                            ),
                                            opacity: supabaseConfigured ? 1 : 0.5,
                                        },
                                    ]}
                                    onPress={
                                        playMode === "local"
                                            ? startLocalGame
                                            : playMode === "create"
                                                ? onCreateRemote
                                                : onJoinRemote
                                    }
                                    disabled={!supabaseConfigured && playMode !== "local"}
                                >
                                        <Text
                                            style={[
                                                styles.resetText,
                                                { fontSize: buttonFontSize },
                                            ]}
                                        >
                                        {playMode === "local"
                                            ? isSmallScreen
                                                ? "▶ Nouvelle partie"
                                                : "Nouvelle partie"
                                            : playMode === "create"
                                                ? isSmallScreen
                                                    ? "＋ Créer remote"
                                                    : "Créer remote"
                                                : isSmallScreen
                                                    ? "↔ Rejoindre"
                                                    : "Rejoindre"}
                                    </Text>
                                </Pressable>
                            </>
                        ) : (
                            useCompactInGameMenu ? (
                                <View
                                    style={[
                                        styles.inGameCompactRow,
                                        { marginTop: lineSpacing * 1.5, gap: lineSpacing },
                                    ]}
                                >
                                    <View style={styles.inGameCompactStatusCol}>
                                        <Text style={[styles.cornerSub, { fontSize: subFontSize }]}>
                                            Partie {playMode === "local" ? "locale" : "remote"}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.cornerSub,
                                                { fontSize: subFontSize, marginTop: lineSpacing },
                                            ]}
                                        >
                                            {syncMessage}
                                        </Text>
                                        {waitingPlayersMessage ? (
                                            <Text
                                                style={[
                                                    styles.cornerSub,
                                                    {
                                                        fontSize: subFontSize,
                                                        marginTop: lineSpacing,
                                                        color: "#fbbf24",
                                                    },
                                                ]}
                                            >
                                                {waitingPlayersMessage}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.inGameCompactButtonsCol}>
                                        {canUseRemote ? (
                                            <Pressable
                                                style={[
                                                    styles.menuButtonSecondary,
                                                    styles.inGameCompactButton,
                                                    {
                                                        paddingVertical: Math.max(
                                                            5,
                                                            resetButtonVerticalPadding - 2,
                                                        ),
                                                        paddingHorizontal: Math.max(
                                                            8,
                                                            resetButtonHorizontalPadding - 2,
                                                        ),
                                                        borderRadius: clamp(
                                                            Math.floor(panelRadius * 0.65),
                                                            5,
                                                            9,
                                                        ),
                                                        opacity: supabaseConfigured ? 1 : 0.5,
                                                    },
                                                ]}
                                                onPress={onSyncRemote}
                                                disabled={!supabaseConfigured}
                                            >
                                                <Text
                                                    style={[
                                                        styles.resetText,
                                                        { fontSize: buttonFontSize },
                                                    ]}
                                                >
                                                    ⟳ Sync
                                                </Text>
                                            </Pressable>
                                        ) : null}
                                        <Pressable
                                            style={[
                                                styles.resetButton,
                                                styles.inGameCompactButton,
                                                {
                                                    marginTop: lineSpacing,
                                                    paddingVertical: Math.max(
                                                        5,
                                                        resetButtonVerticalPadding - 2,
                                                    ),
                                                    paddingHorizontal: Math.max(
                                                        8,
                                                        resetButtonHorizontalPadding - 2,
                                                    ),
                                                    borderRadius: clamp(
                                                        Math.floor(panelRadius * 0.65),
                                                        5,
                                                        9,
                                                    ),
                                                },
                                            ]}
                                            onPress={onQuitGame}
                                        >
                                            <Text
                                                style={[
                                                    styles.resetText,
                                                    { fontSize: buttonFontSize },
                                                ]}
                                            >
                                                ⏹ Quitter
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ) : (
                                <>
                                    <Text
                                        style={[
                                            styles.cornerSub,
                                            {
                                                fontSize: subFontSize,
                                                marginTop: lineSpacing * 2,
                                            },
                                        ]}
                                    >
                                        Partie en cours ({playMode === "local" ? "locale" : "remote"})
                                    </Text>
                                    {canUseRemote ? (
                                        <Pressable
                                            style={[
                                                styles.menuButtonSecondary,
                                                {
                                                    marginTop: lineSpacing,
                                                    paddingVertical: resetButtonVerticalPadding,
                                                    paddingHorizontal:
                                                        resetButtonHorizontalPadding,
                                                    borderRadius: clamp(
                                                        Math.floor(panelRadius * 0.7),
                                                        5,
                                                        10,
                                                    ),
                                                    opacity: supabaseConfigured ? 1 : 0.5,
                                                },
                                            ]}
                                            onPress={onSyncRemote}
                                            disabled={!supabaseConfigured}
                                        >
                                            <Text
                                                style={[
                                                    styles.resetText,
                                                    { fontSize: buttonFontSize },
                                                ]}
                                            >
                                                {isSmallScreen ? "⟳ Sync" : "Synchroniser"}
                                            </Text>
                                        </Pressable>
                                    ) : null}
                                    <Pressable
                                        style={[
                                            styles.resetButton,
                                            {
                                                marginTop: lineSpacing,
                                                paddingVertical: resetButtonVerticalPadding,
                                                paddingHorizontal:
                                                    resetButtonHorizontalPadding,
                                                borderRadius: clamp(
                                                    Math.floor(panelRadius * 0.7),
                                                    5,
                                                    10,
                                                ),
                                            },
                                        ]}
                                        onPress={onQuitGame}
                                    >
                                        <Text
                                            style={[
                                                styles.resetText,
                                                { fontSize: buttonFontSize },
                                            ]}
                                        >
                                            {isSmallScreen ? "⏹ Quitter" : "Quitter la partie"}
                                        </Text>
                                    </Pressable>
                                </>
                            )
                        )}

                        {!useCompactInGameMenu ? (
                            <Text
                                style={[
                                    styles.cornerSub,
                                    {
                                        fontSize: subFontSize,
                                        marginTop: lineSpacing * 2,
                                    },
                                ]}
                            >
                                {syncMessage}
                            </Text>
                        ) : null}
                        {!useCompactInGameMenu && waitingPlayersMessage ? (
                            <Text
                                style={[
                                    styles.cornerSub,
                                    {
                                        fontSize: subFontSize,
                                        marginTop: lineSpacing,
                                        color: "#fbbf24",
                                    },
                                ]}
                            >
                                {waitingPlayersMessage}
                            </Text>
                        ) : null}
                        {!useCompactInGameMenu ? (
                            <Text
                                style={[
                                    styles.cornerSub,
                                    {
                                        fontSize: subFontSize,
                                        marginTop: lineSpacing,
                                    },
                                ]}
                            >
                                Game ID: {remoteGameId ?? "aucun"}
                            </Text>
                        ) : null}
                        {!supabaseConfigured ? (
                            <Text
                                style={[
                                    styles.cornerSub,
                                    {
                                        fontSize: subFontSize,
                                        marginTop: lineSpacing,
                                        color: "#fca5a5",
                                    },
                                ]}
                            >
                                Supabase non configuré (.env requis)
                            </Text>
                        ) : null}
                    </View>
                </View>

                <View
                    style={[
                        styles.stage,
                        { paddingHorizontal: stageGap, paddingVertical: 0 },
                    ]}
                >
                    {isInGame ? (
                        <>
                            <View style={styles.boardLayer}>
                                <View
                                    style={[
                                        styles.board,
                                        {
                                            width: boardSize,
                                            height: boardSize,
                                        },
                                    ]}
                                >
                                    {cells.map(
                                        ({
                                            x,
                                            y,
                                            boardX,
                                            boardY,
                                            playable,
                                            piece,
                                            isLight,
                                        }) => {
                                            const isSelected =
                                                selected?.x === boardX &&
                                                selected?.y === boardY;
                                            const squareKey = keyOf(boardX, boardY);
                                            const isLegalTarget = legalTargets.has(squareKey);
                                            const isLastMoveFrom =
                                                lastMove?.fromX === boardX &&
                                                lastMove?.fromY === boardY;
                                            const isLastMoveTo =
                                                lastMove?.toX === boardX &&
                                                lastMove?.toY === boardY;
                                            return (
                                                <Pressable
                                                    key={`${x},${y}`}
                                                    style={[
                                                        styles.square,
                                                        {
                                                            width: squareSize,
                                                            height: squareSize,
                                                            backgroundColor: playable
                                                                ? isLight
                                                                    ? "#f4e4c8"
                                                                    : "#946e4d"
                                                                : "transparent",
                                                            borderColor: isSelected
                                                                ? "#f59e0b"
                                                                : isLastMoveTo
                                                                    ? "#22c55e"
                                                                    : isLastMoveFrom
                                                                        ? "#60a5fa"
                                                                        : isLegalTarget
                                                                            ? "rgba(99, 102, 241, 0.75)"
                                                                            : "transparent",
                                                        },
                                                    ]}
                                                    onPress={() => {
                                                        if (playable) {
                                                            selectOrMove(boardX, boardY);
                                                        }
                                                    }}
                                                >
                                                    {piece ? (
                                                        <Text
                                                            style={[
                                                                styles.piece,
                                                                {
                                                                    color: PLAYER_COLOR[
                                                                        piece.player
                                                                    ],
                                                                    fontSize: pieceFontSize,
                                                                    textShadowColor:
                                                                        "rgba(0, 0, 0, 0.45)",
                                                                    textShadowOffset: {
                                                                        width: 0,
                                                                        height: 1,
                                                                    },
                                                                    textShadowRadius: 1,
                                                                },
                                                            ]}
                                                        >
                                                            {PIECE_SYMBOL[piece.type]}
                                                        </Text>
                                                    ) : null}
                                                </Pressable>
                                            );
                                        },
                                    )}
                                </View>
                            </View>

                            {[
                                {
                                    key: "black",
                                    label: "Noir",
                                    stats: blackStats,
                                    top: stageGap,
                                    left: stageGap,
                                },
                                {
                                    key: "white",
                                    label: "Blanc",
                                    stats: whiteStats,
                                    top: stageGap,
                                    right: stageGap,
                                },
                                {
                                    key: "red",
                                    label: "Rouge",
                                    stats: redStats,
                                    bottom: stageGap,
                                    left: stageGap,
                                },
                                {
                                    key: "blue",
                                    label: "Bleu",
                                    stats: blueStats,
                                    bottom: stageGap,
                                    right: stageGap,
                                },
                            ].map((panel) => (
                                <View
                                    key={panel.key}
                                    style={[
                                        styles.cornerPanel,
                                        styles.cornerOverlayPanel,
                                        {
                                            width: scorePanelWidth,
                                            borderRadius: panelRadius,
                                            paddingHorizontal: panelHorizontalPadding,
                                            paddingVertical: panelVerticalPadding,
                                            top: panel.top,
                                            right: panel.right,
                                            bottom: panel.bottom,
                                            left: panel.left,
                                        },
                                    ]}
                                >
                                    <View style={styles.cornerTextStack}>
                                        <Text
                                            style={[
                                                styles.cornerTitle,
                                                { fontSize: titleFontSize },
                                            ]}
                                        >
                                            {panel.label}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.cornerSub,
                                                { fontSize: subFontSize },
                                            ]}
                                        >
                                            {playMode === "local"
                                                ? controlByColor[panel.key] === "robot"
                                                    ? "Robot"
                                                    : panel.key === localPlayerColor
                                                        ? normalizedPlayerUsername
                                                        : "Humain"
                                                : remotePlayerIds[panel.key] === "robot"
                                                    ? "Robot"
                                                    : remotePlayerIds[panel.key] ?? "Libre"}
                                        </Text>
                                        <View style={styles.cornerRow}>
                                            <Text
                                                style={[
                                                    styles.cornerSub,
                                                    { fontSize: subFontSize },
                                                ]}
                                            >
                                                Pièces
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.cornerSub,
                                                    { fontSize: subFontSize },
                                                ]}
                                            >
                                                {panel.stats?.pieces ?? 0}
                                            </Text>
                                        </View>
                                        <View style={styles.cornerRow}>
                                            <Text
                                                style={[
                                                    styles.cornerSub,
                                                    { fontSize: subFontSize },
                                                ]}
                                            >
                                                Prises
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.cornerSub,
                                                    { fontSize: subFontSize },
                                                ]}
                                            >
                                                {panel.stats?.captures ?? 0}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </>
                    ) : (
                        <View
                            style={[
                                styles.boardIdleState,
                                {
                                    width: boardSize,
                                    height: boardSize,
                                    borderRadius: panelRadius,
                                },
                            ]}
                        >
                            <Text style={[styles.boardIdleTitle, { fontSize: valueFontSize }]}>
                                Aucune partie en cours
                            </Text>
                            <Text style={[styles.boardIdleSub, { fontSize: subFontSize }]}>
                                Lance une partie depuis le menu pour afficher l echiquier.
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: "#111827",
    },
    layoutRoot: {
        flex: 1,
        flexDirection: "row",
    },
    sidebar: {
        backgroundColor: "#0b1325",
        borderRightWidth: 1,
        borderRightColor: "rgba(255, 255, 255, 0.12)",
        flexShrink: 0,
        alignSelf: "stretch",
    },
    menuPanel: {
        backgroundColor: "rgba(17, 24, 39, 0.92)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
    },
    stage: {
        flex: 1,
        position: "relative",
    },
    boardLayer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    boardIdleState: {
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        backgroundColor: "rgba(15, 23, 42, 0.62)",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.3)",
    },
    boardIdleTitle: {
        color: "#f8fafc",
        fontWeight: "700",
        textAlign: "center",
    },
    boardIdleSub: {
        marginTop: 8,
        color: "#cbd5e1",
        textAlign: "center",
    },
    cornerPanel: {
        flex: 1,
        backgroundColor: "rgba(17, 24, 39, 0.86)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
        justifyContent: "center",
    },
    cornerOverlayPanel: {
        position: "absolute",
        flex: 0,
        zIndex: 2,
    },
    board: {
        flexDirection: "row",
        flexWrap: "wrap",
        backgroundColor: "#111827",
    },
    square: {
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
    },
    piece: {
        fontWeight: "700",
    },
    cornerTextStack: {
        flexDirection: "column",
        gap: 4,
    },
    cornerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
    },
    cornerTitle: {
        color: "#e5e7eb",
        fontWeight: "700",
    },
    cornerValue: {
        color: "#f9fafb",
        fontWeight: "700",
    },
    cornerSub: {
        color: "#d1d5db",
        flexShrink: 1,
    },
    resetButton: {
        backgroundColor: "#2563eb",
    },
    menuButtonSecondary: {
        backgroundColor: "#374151",
    },
    visibilityRow: {
        flexDirection: "row",
    },
    inGameCompactRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    inGameCompactStatusCol: {
        flex: 1,
        minWidth: 0,
    },
    inGameCompactButtonsCol: {
        width: 120,
        alignItems: "stretch",
    },
    inGameCompactButton: {
        minHeight: 0,
    },
    usernameInput: {
        backgroundColor: "#1f2937",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.4)",
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
        color: "#f8fafc",
        fontSize: 13,
    },
    visibilityButton: {
        flex: 1,
        backgroundColor: "#1f2937",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.4)",
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    visibilityButtonActive: {
        backgroundColor: "#2563eb",
        borderColor: "#60a5fa",
    },
    visibilityText: {
        color: "#e5e7eb",
        textAlign: "center",
        fontWeight: "600",
    },
    joinColorButton: {
        minWidth: 74,
        backgroundColor: "#1f2937",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.4)",
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    joinColorButtonDisabled: {
        opacity: 0.45,
    },
    joinableGamesContainer: {
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.2)",
        borderRadius: 8,
        padding: 8,
    },
    joinableGameButton: {
        backgroundColor: "#1f2937",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.35)",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    joinableGameTitle: {
        color: "#f8fafc",
        fontWeight: "700",
        fontSize: 12,
    },
    joinableGameSub: {
        color: "#cbd5e1",
        marginTop: 4,
        fontSize: 11,
    },
    refreshJoinablesButton: {
        backgroundColor: "#374151",
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    playerInputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    playerInputLabel: {
        width: 44,
        color: "#d1d5db",
        fontSize: 12,
        fontWeight: "600",
    },
    playerControlRow: {
        flex: 1,
        flexDirection: "row",
        gap: 6,
    },
    controlButton: {
        flex: 1,
        backgroundColor: "#1f2937",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.35)",
        borderRadius: 6,
        paddingVertical: 6,
    },
    controlButtonActive: {
        backgroundColor: "#2563eb",
        borderColor: "#60a5fa",
    },
    controlButtonText: {
        color: "#e5e7eb",
        textAlign: "center",
        fontSize: 12,
        fontWeight: "600",
    },
    resetText: {
        color: "#fff",
        fontWeight: "700",
        textAlign: "center",
    },
});

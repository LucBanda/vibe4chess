import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
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
import { buildCells, createInitialBoard, keyOf } from "./src/game/board.js";
import { chooseRobotMove } from "./src/game/bot.js";
import { applyMove, createCapturesBy } from "./src/game/engine.js";
import { computeStats } from "./src/game/stats.js";
import {
    createRemoteGame,
    supabaseConfigured,
    syncRemoteGame,
} from "./src/lib/gameApi.js";

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export default function App() {
    const { width, height } = useWindowDimensions();
    const [board, setBoard] = useState(() => createInitialBoard());
    const [turn, setTurn] = useState("white");
    const [selected, setSelected] = useState(null);
    const [moveCount, setMoveCount] = useState(0);
    const [capturesBy, setCapturesBy] = useState({
        ...createCapturesBy(),
    });
    const [remoteGameId, setRemoteGameId] = useState(null);
    const [syncMessage, setSyncMessage] = useState("Remote: non synchronisé");
    const [remoteVisibility, setRemoteVisibility] = useState("private");
    const [playerIdsByColor, setPlayerIdsByColor] = useState({
        white: "",
        red: "",
        black: "",
        blue: "",
    });
    const [controlByColor, setControlByColor] = useState({
        white: "human",
        red: "human",
        black: "human",
        blue: "human",
    });

    const shortSide = Math.min(width, height);
    const sidebarWidth = clamp(Math.floor(width * 0.2), 120, 240);
    const stageWidth = Math.max(width - sidebarWidth, 220);
    const boardPixelSize = Math.floor(Math.min(width, height) - 12);
    const renderedBoardSize = Math.floor(
        clamp(
            Math.min(stageWidth * 0.84, height * 0.76, boardPixelSize),
            196,
            900,
        ),
    );
    const squareSize = Math.floor(renderedBoardSize / BOARD_SIZE);
    const boardSize = squareSize * BOARD_SIZE;
    const menuShortSide = Math.min(sidebarWidth, height);

    const panelHorizontalPadding = clamp(Math.floor(shortSide * 0.018), 10, 18);
    const panelVerticalPadding = clamp(Math.floor(shortSide * 0.016), 8, 16);
    const panelRadius = clamp(Math.floor(shortSide * 0.02), 8, 14);

    const titleFontSize = clamp(Math.floor(shortSide * 0.027), 12, 18);
    const valueFontSize = clamp(Math.floor(shortSide * 0.032), 14, 21);
    const subFontSize = clamp(Math.floor(shortSide * 0.022), 11, 15);
    const buttonFontSize = clamp(Math.floor(menuShortSide * 0.1), 10, 14);
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

    const cells = useMemo(() => buildCells(board), [board]);
    const stats = useMemo(
        () => computeStats(board, capturesBy),
        [board, capturesBy],
    );
    const alivePlayers = stats.filter((s) => s.alive).map((s) => s.player);
    const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;

    const selectOrMove = (x, y) => {
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
        setSelected(null);
    };

    const resetGame = () => {
        setBoard(createInitialBoard());
        setTurn("white");
        setSelected(null);
        setMoveCount(0);
        setCapturesBy(createCapturesBy());
        setSyncMessage("Remote: partie réinitialisée localement");
    };

    const onCreateRemote = async () => {
        try {
            console.log("about to create remote");
            const result = await createRemoteGame({
                board,
                turn,
                moveCount,
                capturesBy,
                winner,
            }, {
                visibility: remoteVisibility,
                playerIdsByColor,
            });
            setRemoteGameId(result.id);
            setSyncMessage(
                `Remote: partie créée ${result.visibility === "public" ? "publique" : "privée"} (${result.id.slice(0, 8)}...)`,
            );
        } catch (error) {
            Alert.alert("Supabase", error.message);
        }
    };

    const updatePlayerId = (color, value) => {
        setPlayerIdsByColor((previous) => ({
            ...previous,
            [color]: value,
        }));
    };

    const setPlayerControl = (color, mode) => {
        setControlByColor((previous) => ({
            ...previous,
            [color]: mode,
        }));
    };

    const onSyncRemote = async () => {
        if (!remoteGameId) {
            Alert.alert("Supabase", "Crée d'abord une partie distante.");
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

    useEffect(() => {
        if (winner || controlByColor[turn] !== "robot") {
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
            setSelected(null);
            setSyncMessage(
                `Robot ${PLAYER_LABEL[turn]}: (${botMove.fromX},${botMove.fromY}) -> (${botMove.toX},${botMove.toY})`,
            );
        }, 500);

        return () => clearTimeout(timerId);
    }, [board, turn, moveCount, capturesBy, winner, controlByColor]);

    return (
        <SafeAreaView style={styles.page}>
            <StatusBar style="light" />
            <View style={styles.layoutRoot}>
                <View
                    style={[
                        styles.sidebar,
                        {
                            width: sidebarWidth,
                            padding: panelVerticalPadding,
                            gap: stageGap,
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
                        <Pressable
                            style={[
                                styles.resetButton,
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
                                },
                            ]}
                            onPress={resetGame}
                        >
                            <Text
                                style={[
                                    styles.resetText,
                                    { fontSize: buttonFontSize },
                                ]}
                            >
                                Nouvelle partie
                            </Text>
                        </Pressable>

                        <Text
                            style={[
                                styles.cornerSub,
                                {
                                    fontSize: subFontSize,
                                    marginTop: lineSpacing * 2,
                                },
                            ]}
                        >
                            Visibilité
                        </Text>
                        <View
                            style={[
                                styles.visibilityRow,
                                { marginTop: lineSpacing, gap: lineSpacing },
                            ]}
                        >
                            <Pressable
                                style={[
                                    styles.visibilityButton,
                                    remoteVisibility === "private"
                                        ? styles.visibilityButtonActive
                                        : null,
                                ]}
                                onPress={() => setRemoteVisibility("private")}
                            >
                                <Text style={styles.visibilityText}>
                                    Privée
                                </Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.visibilityButton,
                                    remoteVisibility === "public"
                                        ? styles.visibilityButtonActive
                                        : null,
                                ]}
                                onPress={() => setRemoteVisibility("public")}
                            >
                                <Text style={styles.visibilityText}>
                                    Publique
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
                            Joueurs (UUID Supabase)
                        </Text>
                        {PLAYERS.map((color) => (
                            <View
                                key={color}
                                style={[
                                    styles.playerInputRow,
                                    { marginTop: lineSpacing },
                                ]}
                            >
                                <Text style={styles.playerInputLabel}>
                                    {PLAYER_LABEL[color]}
                                </Text>
                                <TextInput
                                    style={styles.playerInput}
                                    value={playerIdsByColor[color]}
                                    onChangeText={(value) =>
                                        updatePlayerId(color, value)
                                    }
                                    placeholder={
                                        color === "white"
                                            ? "vide = créateur"
                                            : "UUID joueur"
                                    }
                                    placeholderTextColor="#94a3b8"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                        ))}

                        <Text
                            style={[
                                styles.cornerSub,
                                {
                                    fontSize: subFontSize,
                                    marginTop: lineSpacing * 2,
                                },
                            ]}
                        >
                            Contrôle des joueurs
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
                                },
                            ]}
                            onPress={onCreateRemote}
                            disabled={!supabaseConfigured}
                        >
                            <Text
                                style={[
                                    styles.resetText,
                                    { fontSize: buttonFontSize },
                                ]}
                            >
                                {supabaseConfigured ? "Créer remote" : ""}
                            </Text>
                        </Pressable>

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
                                Synchroniser
                            </Text>
                        </Pressable>

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
                    style={[styles.stage, { padding: stageGap, gap: stageGap }]}
                >
                    <View style={[styles.stageRow, { gap: stageGap }]}>
                        <View
                            style={[
                                styles.cornerPanel,
                                {
                                    borderRadius: panelRadius,
                                    paddingHorizontal: panelHorizontalPadding,
                                    paddingVertical: panelVerticalPadding,
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
                                    Noir
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
                                        {blackStats?.pieces ?? 0}
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
                                        {blackStats?.captures ?? 0}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <View style={{ width: boardSize }} />
                        <View
                            style={[
                                styles.cornerPanel,
                                {
                                    borderRadius: panelRadius,
                                    paddingHorizontal: panelHorizontalPadding,
                                    paddingVertical: panelVerticalPadding,
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
                                    Blanc
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
                                        {whiteStats?.pieces ?? 0}
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
                                        {whiteStats?.captures ?? 0}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.stageMiddleRow, { gap: stageGap }]}>
                        <View style={styles.sideSpacer} />
                        <View
                            style={[
                                styles.board,
                                {
                                    width: boardSize,
                                    height: boardSize,
                                },
                            ]}
                        >
                            {cells.map(({ x, y, playable, piece, isLight }) => {
                                const isSelected =
                                    selected?.x === x && selected?.y === y;
                                return (
                                    <Pressable
                                        key={keyOf(x, y)}
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
                                                    : "transparent",
                                            },
                                        ]}
                                        onPress={() => {
                                            if (playable) {
                                                selectOrMove(x, y);
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
                                                            "rgba(0, 0, 0, 0.65)",
                                                        textShadowOffset: {
                                                            width: 0,
                                                            height: 1,
                                                        },
                                                        textShadowRadius: 2,
                                                    },
                                                ]}
                                            >
                                                {PIECE_SYMBOL[piece.type]}
                                            </Text>
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </View>
                        <View style={styles.sideSpacer} />
                    </View>

                    <View style={[styles.stageRow, { gap: stageGap }]}>
                        <View
                            style={[
                                styles.cornerPanel,
                                {
                                    borderRadius: panelRadius,
                                    paddingHorizontal: panelHorizontalPadding,
                                    paddingVertical: panelVerticalPadding,
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
                                    Rouge
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
                                        {redStats?.pieces ?? 0}
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
                                        {redStats?.captures ?? 0}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <View style={{ width: boardSize }} />
                        <View
                            style={[
                                styles.cornerPanel,
                                {
                                    borderRadius: panelRadius,
                                    paddingHorizontal: panelHorizontalPadding,
                                    paddingVertical: panelVerticalPadding,
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
                                    Bleu
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
                                        {blueStats?.pieces ?? 0}
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
                                        {blueStats?.captures ?? 0}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
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
    },
    menuPanel: {
        backgroundColor: "rgba(17, 24, 39, 0.92)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
    },
    stage: {
        flex: 1,
    },
    stageRow: {
        flex: 1,
        flexDirection: "row",
    },
    stageMiddleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    sideSpacer: {
        flex: 1,
    },
    cornerPanel: {
        flex: 1,
        backgroundColor: "rgba(17, 24, 39, 0.86)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
        justifyContent: "center",
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
    playerInput: {
        flex: 1,
        backgroundColor: "#0f172a",
        borderWidth: 1,
        borderColor: "rgba(148, 163, 184, 0.35)",
        color: "#f8fafc",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        fontSize: 12,
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

import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { BOARD_SIZE, PLAYER_COLOR, PLAYER_LABEL, PIECE_SYMBOL } from "./src/game/constants.js";
import { buildCells, createInitialBoard, keyOf } from "./src/game/board.js";
import { getNextAlivePlayer, isLegalMove, shouldPromote } from "./src/game/rules.js";
import { computeStats } from "./src/game/stats.js";

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
        white: 0,
        red: 0,
        black: 0,
        blue: 0,
    });

    const shortSide = Math.min(width, height);
    const sidebarWidth = clamp(Math.floor(width * 0.2), 120, 240);
    const stageWidth = Math.max(width - sidebarWidth, 220);
    const boardPixelSize = Math.floor(Math.min(width, height) - 12);
    const renderedBoardSize = Math.floor(
        clamp(Math.min(stageWidth * 0.84, height * 0.76, boardPixelSize), 196, 900),
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

    const resetButtonVerticalPadding = clamp(Math.floor(menuShortSide * 0.06), 6, 10);
    const resetButtonHorizontalPadding = clamp(Math.floor(menuShortSide * 0.06), 8, 14);
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

        const sourceKey = keyOf(selected.x, selected.y);
        const movingPiece = board[sourceKey];

        if (!movingPiece || movingPiece.player !== turn) {
            setSelected(null);
            return;
        }

        if (target && target.player === turn) {
            setSelected({ x, y });
            return;
        }

        if (!isLegalMove(board, selected.x, selected.y, x, y, movingPiece)) {
            return;
        }

        const nextBoard = { ...board };
        delete nextBoard[sourceKey];

        const movedPiece = shouldPromote(movingPiece, x, y)
            ? { ...movingPiece, type: "queen" }
            : movingPiece;

        nextBoard[squareKey] = movedPiece;

        const nextCaptures = { ...capturesBy };
        if (target) {
            nextCaptures[turn] += 1;
        }

        const nextStats = computeStats(nextBoard, nextCaptures);
        const nextAlive = nextStats.filter((s) => s.alive).map((s) => s.player);
        const nextTurn = getNextAlivePlayer(turn, nextAlive);

        setBoard(nextBoard);
        setCapturesBy(nextCaptures);
        setTurn(nextTurn);
        setMoveCount((value) => value + 1);
        setSelected(null);
    };

    const resetGame = () => {
        setBoard(createInitialBoard());
        setTurn("white");
        setSelected(null);
        setMoveCount(0);
        setCapturesBy({ white: 0, red: 0, black: 0, blue: 0 });
    };

    const whiteStats = stats.find((s) => s.player === "white");
    const redStats = stats.find((s) => s.player === "red");
    const blackStats = stats.find((s) => s.player === "black");
    const blueStats = stats.find((s) => s.player === "blue");

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
                                { fontSize: valueFontSize, marginTop: lineSpacing },
                            ]}
                        >
                            {winner
                                ? `Gagnant: ${PLAYER_LABEL[winner]}`
                                : PLAYER_LABEL[turn]}
                        </Text>
                        <Text
                            style={[
                                styles.cornerSub,
                                { fontSize: subFontSize, marginTop: lineSpacing },
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
                                    paddingHorizontal: resetButtonHorizontalPadding,
                                    borderRadius: clamp(Math.floor(panelRadius * 0.7), 5, 10),
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
                    </View>
                </View>

                <View style={[styles.stage, { padding: stageGap, gap: stageGap }]}>
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
                                const isSelected = selected?.x === x && selected?.y === y;
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
                                                        color: PLAYER_COLOR[piece.player],
                                                        fontSize: pieceFontSize,
                                                        textShadowColor: "rgba(0, 0, 0, 0.65)",
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
    resetText: {
        color: "#fff",
        fontWeight: "700",
        textAlign: "center",
    },
});

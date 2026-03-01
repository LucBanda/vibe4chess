import { StatusBar } from "expo-status-bar";
import { Chess } from "chess.js";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  createRemoteGame,
  syncRemoteGame,
  supabaseConfigured,
} from "./src/lib/gameApi";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

const PIECE_SYMBOLS = {
  wp: "♙",
  wr: "♖",
  wn: "♘",
  wb: "♗",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  br: "♜",
  bn: "♞",
  bb: "♝",
  bq: "♛",
  bk: "♚",
};

function buildSquares(chess) {
  return RANKS.flatMap((rank, rankIndex) =>
    FILES.map((file, fileIndex) => {
      const square = `${file}${rank}`;
      const piece = chess.get(square);
      return {
        square,
        isLight: (rankIndex + fileIndex) % 2 === 0,
        piece,
      };
    }),
  );
}

function pieceToSymbol(piece) {
  if (!piece) {
    return "";
  }
  return PIECE_SYMBOLS[`${piece.color}${piece.type}`] ?? "";
}

export default function App() {
  const [chess, setChess] = useState(() => new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [remoteGameId, setRemoteGameId] = useState(null);
  const [syncMessage, setSyncMessage] = useState("Non synchronisée");
  const { width } = useWindowDimensions();

  const boardBorderWidth = 2;
  const maxBoardSize = Math.min(width - 24, 520);
  const squareSize = Math.floor(maxBoardSize / 8);
  const boardSize = squareSize * 8;
  const squares = useMemo(() => buildSquares(chess), [chess]);
  const history = useMemo(() => chess.history(), [chess]);
  const currentTurn = chess.turn() === "w" ? "Blancs" : "Noirs";
  const gameOver = chess.isGameOver();

  const selectOrMove = (square) => {
    if (!selectedSquare) {
      const target = chess.get(square);
      if (!target || target.color !== chess.turn()) {
        return;
      }
      setSelectedSquare(square);
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    const next = new Chess(chess.fen());
    const move = next.move({
      from: selectedSquare,
      to: square,
      promotion: "q",
    });

    if (!move) {
      const target = chess.get(square);
      if (target && target.color === chess.turn()) {
        setSelectedSquare(square);
      }
      return;
    }

    setChess(next);
    setSelectedSquare(null);
  };

  const resetGame = () => {
    setChess(new Chess());
    setSelectedSquare(null);
    setSyncMessage("Partie réinitialisée (local)");
  };

  const onCreateRemote = async () => {
    try {
      const result = await createRemoteGame(chess);
      setRemoteGameId(result.id);
      setSyncMessage(`Partie distante créée (${result.id.slice(0, 8)}...)`);
    } catch (error) {
      Alert.alert("Supabase", error.message);
    }
  };

  const onSyncRemote = async () => {
    if (!remoteGameId) {
      Alert.alert("Supabase", "Créez d'abord une partie distante.");
      return;
    }
    try {
      await syncRemoteGame(remoteGameId, chess);
      setSyncMessage("Synchronisation réussie");
    } catch (error) {
      Alert.alert("Supabase", error.message);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Expo Chess</Text>
        <Text style={styles.subtitle}>Tour en cours: {currentTurn}</Text>
        {gameOver ? <Text style={styles.gameOver}>Partie terminée</Text> : null}

        <View
          style={[
            styles.boardFrame,
            {
              width: boardSize + boardBorderWidth * 2,
              height: boardSize + boardBorderWidth * 2,
            },
          ]}
        >
          <View style={[styles.board, { width: boardSize, height: boardSize }]}>
            {squares.map(({ square, isLight, piece }) => {
              const selected = selectedSquare === square;
              return (
                <Pressable
                  key={square}
                  style={[
                    styles.square,
                    {
                      width: squareSize,
                      height: squareSize,
                      backgroundColor: isLight ? "#f2e8dc" : "#8a6f58",
                    },
                    selected && styles.selectedSquare,
                  ]}
                  onPress={() => selectOrMove(square)}
                >
                  <Text style={styles.piece}>{pieceToSymbol(piece)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={resetGame}>
            <Text style={styles.buttonText}>Nouvelle partie</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={onCreateRemote}>
            <Text style={styles.buttonText}>Créer game Supabase</Text>
          </Pressable>
          <Pressable
            style={[styles.button, !supabaseConfigured && styles.buttonDisabled]}
            onPress={onSyncRemote}
            disabled={!supabaseConfigured}
          >
            <Text style={styles.buttonText}>Synchroniser</Text>
          </Pressable>
        </View>

        <Text style={styles.syncInfo}>{syncMessage}</Text>
        <Text style={styles.remoteId}>
          Game ID: {remoteGameId ? remoteGameId : "aucune"}
        </Text>

        <View style={styles.history}>
          <Text style={styles.historyTitle}>Historique des coups</Text>
          <Text style={styles.historyText}>
            {history.length === 0 ? "Aucun coup pour l'instant." : history.join(" ")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f6f6f2",
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    alignItems: "center",
    gap: 12,
  },
  title: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: "700",
    color: "#1e1e1e",
  },
  subtitle: {
    fontSize: 16,
    color: "#404040",
  },
  gameOver: {
    fontSize: 16,
    fontWeight: "600",
    color: "#842029",
    backgroundColor: "#f8d7da",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  board: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  boardFrame: {
    borderWidth: 2,
    borderColor: "#3f2f24",
  },
  square: {
    justifyContent: "center",
    alignItems: "center",
  },
  selectedSquare: {
    borderWidth: 3,
    borderColor: "#f7b500",
  },
  piece: {
    fontSize: 30,
  },
  actions: {
    width: "100%",
    gap: 8,
    marginTop: 4,
  },
  button: {
    backgroundColor: "#2f4f4f",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  syncInfo: {
    color: "#2f4f4f",
    fontSize: 14,
  },
  remoteId: {
    color: "#444444",
    fontSize: 12,
  },
  history: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d4d4d4",
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  historyText: {
    color: "#222222",
    lineHeight: 20,
  },
});

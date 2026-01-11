import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getChessBoardColors } from '../theme/colors';
// Logic library (install: npm install chess.js)
// We guard import to avoid runtime crash if not installed yet.
let ChessLib;
try {
  // chess.js >=1.0 uses named export Chess
  // eslint-disable-next-line import/no-extraneous-dependencies
  // dynamic require for compatibility
  // eslint-disable-next-line global-require
  const mod = require('chess.js');
  ChessLib = mod.Chess || mod; // handle default export older versions
} catch (e) {
  ChessLib = null;
}

const iconNameFromType = {
  p: 'chess-pawn',
  r: 'chess-rook',
  n: 'chess-knight',
  b: 'chess-bishop',
  q: 'chess-queen',
  k: 'chess-king',
};

export default function ChessBoard({ fen = 'start', size = 320, borderRadius = 0, onMove }) {
  const squareSize = size / 8;
  const boardColors = getChessBoardColors();
  const dark = boardColors.darkSquare;
  const light = boardColors.lightSquare;
  const pieceColorWhite = boardColors.pieceWhite;
  const pieceColorBlack = boardColors.pieceBlack;
  const highlightColor = boardColors.highlight;
  const moveDotColor = boardColors.moveDot;

  const [game] = useState(() => {
    if (!ChessLib) return null;
    const g = new ChessLib();
    if (fen !== 'start') {
      try { g.load(fen); } catch (e) { /* ignore invalid fen */ }
    }
    return g;
  });
  const [boardData, setBoardData] = useState(() => {
    if (!game) {
      return [
        ['bR','bN','bB','bQ','bK','bB','bN','bR'],
        ['bP','bP','bP','bP','bP','bP','bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wP','wP','wP','wP','wP','wP','wP','wP'],
        ['wR','wN','wB','wQ','wK','wB','wN','wR'],
      ];
    }
    return game.board().map(rank => rank.map(cell => {
      if (!cell) return null;
      return (cell.color === 'w' ? 'w' : 'b') + cell.type.toUpperCase();
    }));
  });
  const [selected, setSelected] = useState(null); // { r, c, square }
  const [legalTargets, setLegalTargets] = useState([]); // ['e4','e5'] etc.

  const algebraicFromRC = (r, c) => String.fromCharCode(97 + c) + (8 - r);
  const rcFromAlgebraic = sq => ({ r: 8 - parseInt(sq[1], 10), c: sq.charCodeAt(0) - 97 });

  const refreshBoard = () => {
    if (!game) return;
    setBoardData(game.board().map(rank => rank.map(cell => {
      if (!cell) return null;
      return (cell.color === 'w' ? 'w' : 'b') + cell.type.toUpperCase();
    })));
  };

  const onSquarePress = useCallback((r, c) => {
    if (!game) return;
    const square = algebraicFromRC(r, c);
    const piece = game.get(square);

    // If selecting same square -> deselect
    if (selected && selected.square === square) {
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    // If there is a selection and this is a legal target -> move
    if (selected && legalTargets.includes(square)) {
      let moveObj = null;
      try {
        moveObj = game.move({ from: selected.square, to: square, promotion: 'q' });
      } catch (e) { /* invalid move ignore */ }
      setSelected(null);
      setLegalTargets([]);
      refreshBoard();
      if (moveObj && onMove) {
        // Provide minimal move payload (SAN + from/to)
        onMove({ san: moveObj.san, from: moveObj.from, to: moveObj.to, flags: moveObj.flags });
      }
      return;
    }

    // Otherwise attempt new selection (respect turn)
    if (piece && piece.color === game.turn()) {
      const moves = game.moves({ square, verbose: true });
      setSelected({ r, c, square });
      setLegalTargets(moves.map(m => m.to));
    } else {
      setSelected(null);
      setLegalTargets([]);
    }
  }, [game, selected, legalTargets]);

  // Reload board when incoming fen prop changes (avoid redundant reloads)
  const lastLoadedFenRef = React.useRef(null);
  useEffect(() => {
    if (!game) return;
    if (fen == null) return;
    if (lastLoadedFenRef.current === fen) return;
    if (fen === 'start') {
      try { game.reset(); } catch (e) { /* ignore */ }
    } else {
      try { game.load(fen); } catch (e) { /* ignore invalid fen */ }
    }
    lastLoadedFenRef.current = fen;
    setSelected(null);
    setLegalTargets([]);
    refreshBoard();
  }, [fen, game]);

  const renderSquareContent = (sq, r, c) => {
    const squareAlg = algebraicFromRC(r, c);
    const isSelected = selected && selected.square === squareAlg;
    const isLegal = legalTargets.includes(squareAlg);
    const iconSize = squareSize * 0.80;
    return (
      <>
        {sq ? (
          <View style={{ padding: squareSize * 0.05, alignItems: 'center', justifyContent: 'center' }}>
            {/* Background "Outline" Icon */}
            <FontAwesome5
              name={iconNameFromType[sq[1].toLowerCase()]}
              size={iconSize}
              color={sq[0] === 'w' ? '#000' : '#fff'}
              solid
              style={{
                position: 'absolute',
                textShadowColor: sq[0] === 'w' ? '#000' : '#fff',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 2,
              }}
            />

            {/* Main Foreground Icon */}
            <FontAwesome5
              name={iconNameFromType[sq[1].toLowerCase()]}
              size={iconSize}
              color={sq[0] === 'w' ? pieceColorWhite : pieceColorBlack}
              solid
              style={{
                textShadowColor: sq[0] === 'w' ? '#000' : '#fff',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 2,
              }}
            />
          </View>
        ) : null}
        {isLegal && (
          <View style={{ position: 'absolute', width: squareSize * 0.3, height: squareSize * 0.3, borderRadius: 999, backgroundColor: moveDotColor, opacity: 0.5 }} />
        )}
        {isSelected && (
          <View style={{ position: 'absolute', inset: 0, borderWidth: 2, borderColor: highlightColor, borderRadius: 4 }} />
        )}
      </>
    );
  };

  return (
    <View style={{ opacity: 0.99 }}>
    <View style={{ width: size, height: size, borderRadius, overflow: 'hidden', backgroundColor: boardColors.frame, borderWidth: 0, borderColor: boardColors.border }}>
      {boardData.map((rank, r) => (
        <View key={`r-${r}`} style={{ flexDirection: 'row' }}>
          {rank.map((sq, c) => {
            const isDark = (r + c) % 2 === 1;
            const bg = isDark ? dark : light;
            return (
              <Pressable
                key={`sq-${r}-${c}`}
                onPress={() => onSquarePress(r, c)}
                style={{ width: squareSize, height: squareSize, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
              >
                {renderSquareContent(sq, r, c)}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
    </View>
  );
}

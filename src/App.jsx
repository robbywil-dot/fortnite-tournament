import React, { useState, useEffect } from 'react';
import { Trophy, Users, Target, RotateCcw, Play, Save, Trash2, Copy, Check } from 'lucide-react';
import { db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// Scoring tables
const PLACE_SCORING = {
  1: 30, 2: 25, 3: 22, 4: 20, 5: 18, 6: 16, 7: 14, 8: 12, 9: 10, 10: 8,
  11: 7, 12: 6, 13: 5, 14: 4, 15: 3, 16: 2, 17: 2, 18: 2, 19: 2, 20: 2,
  21: 1, 22: 1, 23: 1, 24: 1, 25: 1
};

const ELIM_SCORING = (elims) => {
  if (elims <= 10) {
    return elims * 1;
  } else {
    return 10 + ((elims - 10) * 2);
  }
};

const SELF_ELIM_PENALTY = -5;

const calculatePlacePoints = (place) => {
  const p = parseInt(place);
  if (isNaN(p) || p < 1 || p > 100) return 0;
  if (p <= 25) return PLACE_SCORING[p];
  return 0;
};

const calculateElimPoints = (elims) => {
  const e = parseInt(elims);
  if (isNaN(e) || e < 0 || e > 100) return 0;
  return ELIM_SCORING(e);
};

const calculateSelfElimPoints = (selfElim) => {
  return selfElim ? SELF_ELIM_PENALTY : 0;
};

const generatePasscode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function App() {
  const [view, setView] = useState('home');
  const [passcode, setPasscode] = useState('');
  const [inputPasscode, setInputPasscode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  
  const [totalRounds, setTotalRounds] = useState(3);
  const [playerNames, setPlayerNames] = useState(['', '', '', '']);
  const [activePlayers, setActivePlayers] = useState(2);
  
  const [currentRound, setCurrentRound] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [scores, setScores] = useState({});
  const [tournamentActive, setTournamentActive] = useState(false);
  const [tournamentComplete, setTournamentComplete] = useState(false);
  
  const [placeInput, setPlaceInput] = useState('');
  const [elimsInput, setElimsInput] = useState('');
  const [selfElimInput, setSelfElimInput] = useState(false);

  // Real-time listener for tournament updates
  useEffect(() => {
    if (!passcode) return;

    const unsubscribe = onSnapshot(doc(db, 'tournaments', passcode), (docSnap) => {
      if (docSnap.exists()) {
        const state = docSnap.data();
        setTotalRounds(state.totalRounds);
        setPlayerNames(state.playerNames);
        setActivePlayers(state.activePlayers);
        setCurrentRound(state.currentRound);
        setScores(state.scores);
        setTournamentActive(state.tournamentActive);
        setTournamentComplete(state.tournamentComplete);
      }
    });

    return () => unsubscribe();
  }, [passcode]);

  const loadTournamentData = async (code) => {
    try {
      const docRef = doc(db, 'tournaments', code);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const state = docSnap.data();
        setTotalRounds(state.totalRounds);
        setPlayerNames(state.playerNames);
        setActivePlayers(state.activePlayers);
        setCurrentRound(state.currentRound);
        setScores(state.scores);
        setTournamentActive(state.tournamentActive);
        setTournamentComplete(state.tournamentComplete);
        setPasscode(code);
        setView('tournament');
        return true;
      }
      return false;
    } catch (error) {
      console.log('Tournament not found:', error);
      return false;
    }
  };

  const saveTournamentData = async (code, state) => {
    try {
      await setDoc(doc(db, 'tournaments', code), state);
    } catch (error) {
      console.error('Failed to save tournament data:', error);
    }
  };

  const createTournament = () => {
    const filteredNames = playerNames.slice(0, activePlayers).filter(n => n.trim());
    if (filteredNames.length !== activePlayers) {
      alert('Please enter all player names');
      return;
    }
    
    const newPasscode = generatePasscode();
    const initialScores = {};
    filteredNames.forEach(name => {
      initialScores[name] = {};
    });
    
    const state = {
      totalRounds,
      playerNames: filteredNames,
      activePlayers,
      currentRound: 1,
      scores: initialScores,
      tournamentActive: true,
      tournamentComplete: false
    };
    
    setPlayerNames(filteredNames);
    setCurrentRound(1);
    setScores(initialScores);
    setTournamentActive(true);
    setTournamentComplete(false);
    setPasscode(newPasscode);
    saveTournamentData(newPasscode, state);
    setView('share');
  };

  const joinTournament = async () => {
    const code = inputPasscode.toUpperCase().trim();
    if (code.length !== 4) {
      alert('Please enter a 4-character passcode');
      return;
    }
    
    const loaded = await loadTournamentData(code);
    if (!loaded) {
      alert('Tournament not found. Please check the passcode and try again.');
    }
  };

  const submitScore = () => {
    const place = parseInt(placeInput);
    const elims = parseInt(elimsInput);
    
    if (isNaN(place) || place < 1 || place > 100) {
      alert('Place must be between 1 and 100');
      return;
    }
    
    if (isNaN(elims) || elims < 0 || elims > 100) {
      alert('Eliminations must be between 0 and 100');
      return;
    }

    const placePoints = calculatePlacePoints(place);
    const elimPoints = calculateElimPoints(elims);
    const selfElimPoints = calculateSelfElimPoints(selfElimInput);
    const total = placePoints + elimPoints + selfElimPoints;

    const roundScore = {
      place,
      elims,
      selfElim: selfElimInput,
      placePoints,
      elimPoints,
      selfElimPoints,
      total
    };

    const newScores = {
      ...scores,
      [selectedPlayer]: {
        ...scores[selectedPlayer],
        [currentRound]: roundScore
      }
    };
    
    setScores(newScores);
    
    const state = {
      totalRounds,
      playerNames,
      activePlayers,
      currentRound,
      scores: newScores,
      tournamentActive,
      tournamentComplete
    };
    saveTournamentData(passcode, state);
    
    setSelectedPlayer(null);
    setPlaceInput('');
    setElimsInput('');
    setSelfElimInput(false);
  };

  const advanceRound = () => {
    const allSubmitted = playerNames.every(p => scores[p]?.[currentRound] !== undefined);
    if (!allSubmitted) {
      alert('All players must submit scores before advancing');
      return;
    }

    if (currentRound < totalRounds) {
      const newRound = currentRound + 1;
      setCurrentRound(newRound);
      const state = {
        totalRounds,
        playerNames,
        activePlayers,
        currentRound: newRound,
        scores,
        tournamentActive,
        tournamentComplete: false
      };
      saveTournamentData(passcode, state);
    } else {
      const state = {
        totalRounds,
        playerNames,
        activePlayers,
        currentRound,
        scores,
        tournamentActive,
        tournamentComplete: true
      };
      setTournamentComplete(true);
      saveTournamentData(passcode, state);
    }
  };

  const handleEndTournament = async () => {
    try {
      await deleteDoc(doc(db, 'tournaments', passcode));
    } catch (error) {
      console.log('Storage delete error:', error);
    }
    
    setView('home');
    setPlayerNames(['', '', '', '']);
    setActivePlayers(2);
    setTotalRounds(3);
    setCurrentRound(1);
    setScores({});
    setTournamentActive(false);
    setTournamentComplete(false);
    setSelectedPlayer(null);
    setPasscode('');
    setInputPasscode('');
    setShowEndConfirm(false);
  };

  const calculateTotalPoints = (player) => {
    if (!scores[player]) return 0;
    return Object.values(scores[player]).reduce((sum, roundScore) => sum + roundScore.total, 0);
  };

  const getLeaderboard = () => {
    return playerNames
      .map(player => ({
        name: player,
        total: calculateTotalPoints(player),
        rounds: scores[player] || {}
      }))
      .sort((a, b) => b.total - a.total);
  };

  const getRoundStatus = (player, round) => {
    return scores[player]?.[round] !== undefined;
  };

  const copyToClipboard = () => {
    const shareText = `🎮 Join my Fortnite Tournament!\n\nPasscode: ${passcode}\n\nGo to: ${window.location.origin}\nClick "Join Existing Tournament"`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-600 rounded-3xl shadow-2xl p-1">
            <div className="bg-gray-900 rounded-3xl p-6">
              <div className="flex items-center justify-center mb-6">
                <Trophy className="w-12 h-12 text-yellow-400 mr-3 animate-pulse" />
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
                  FORTNITE
                </h1>
              </div>
              <div className="text-center mb-8">
                <p className="text-2xl font-bold text-white tracking-wide">TOURNAMENT</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => setView('create')}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-black text-lg hover:from-green-600 hover:to-emerald-700 transition transform hover:scale-105 shadow-lg uppercase tracking-wider border-4 border-green-400"
                >
                  <Play className="w-6 h-6 inline mr-2" />
                  Create Tournament
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-gray-900 text-gray-400 font-bold uppercase">Or</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-black text-cyan-400 uppercase tracking-wider text-center">
                    Join Existing Tournament
                  </label>
                  <input
                    type="text"
                    value={inputPasscode}
                    onChange={(e) => setInputPasscode(e.target.value.toUpperCase())}
                    placeholder="Enter 4-digit code"
                    maxLength={4}
                    className="w-full px-4 py-3 bg-gray-800 border-4 border-purple-500 text-white text-center text-2xl font-black rounded-xl focus:ring-4 focus:ring-cyan-400 focus:border-cyan-400 placeholder-gray-600 uppercase tracking-widest"
                  />
                  <button
                    onClick={joinTournament}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-black text-lg hover:from-purple-700 hover:to-pink-700 transition transform hover:scale-105 shadow-lg uppercase tracking-wider border-4 border-purple-400"
                  >
                    <Users className="w-6 h-6 inline mr-2" />
                    Join Tournament
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-600 rounded-3xl shadow-2xl p-1">
            <div className="bg-gray-900 rounded-3xl p-6">
              <div className="flex items-center justify-center mb-6">
                <Trophy className="w-12 h-12 text-yellow-400 mr-3 animate-pulse" />
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 uppercase">
                  Create Tournament
                </h1>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-cyan-400 mb-2 uppercase tracking-wider">
                    Squad Size
                  </label>
                  <select
                    value={activePlayers}
                    onChange={(e) => setActivePlayers(parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-800 border-2 border-purple-500 text-white rounded-xl focus:ring-2 focus:ring-cyan-400 font-bold"
                  >
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>{n} Players</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-cyan-400 mb-2 uppercase tracking-wider">
                    Match Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={totalRounds}
                    onChange={(e) => setTotalRounds(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-3 bg-gray-800 border-2 border-purple-500 text-white rounded-xl focus:ring-2 focus:ring-cyan-400 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-cyan-400 mb-2 uppercase tracking-wider">
                    Player Names
                  </label>
                  {[...Array(activePlayers)].map((_, i) => (
                    <input
                      key={i}
                      type="text"
                      value={playerNames[i]}
                      onChange={(e) => {
                        const newNames = [...playerNames];
                        newNames[i] = e.target.value;
                        setPlayerNames(newNames);
                      }}
                      placeholder={`Player ${i + 1}`}
                      className="w-full px-4 py-3 bg-gray-800 border-2 border-purple-500 text-white rounded-xl mb-2 focus:ring-2 focus:ring-cyan-400 font-bold placeholder-gray-500"
                    />
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setView('home')}
                    className="flex-1 bg-gray-700 text-white py-4 rounded-xl font-black text-lg hover:bg-gray-600 transition uppercase tracking-wider border-4 border-gray-600"
                  >
                    Back
                  </button>
                  <button
                    onClick={createTournament}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-black text-lg hover:from-green-600 hover:to-emerald-700 transition transform hover:scale-105 shadow-lg uppercase tracking-wider border-4 border-green-400"
                  >
                    <Play className="w-6 h-6 inline mr-2" />
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'share') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-600 rounded-3xl shadow-2xl p-1">
            <div className="bg-gray-900 rounded-3xl p-6">
              <div className="text-center mb-6">
                <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 uppercase mb-2">
                  Tournament Created!
                </h1>
                <p className="text-cyan-400 font-bold">Share this code with your squad</p>
              </div>

              <div className="bg-gray-800 rounded-2xl p-6 mb-6 border-4 border-cyan-400">
                <p className="text-cyan-400 text-sm font-bold uppercase text-center mb-2">Tournament Passcode</p>
                <div className="text-6xl font-black text-white text-center tracking-widest mb-4">
                  {passcode}
                </div>
                <button
                  onClick={copyToClipboard}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-black hover:from-purple-700 hover:to-pink-700 transition flex items-center justify-center uppercase tracking-wider border-4 border-purple-400"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 mr-2" />
                      Copy Share Info
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setView('tournament')}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-black text-lg hover:from-green-600 hover:to-emerald-700 transition transform hover:scale-105 shadow-lg uppercase tracking-wider border-4 border-green-400"
              >
                Start Tournament
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const leaderboard = getLeaderboard();
  const allRoundScoresSubmitted = playerNames.every(p => getRoundStatus(p, currentRound));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Confirmation Modal */}
        {showEndConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
            <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-600 rounded-3xl shadow-2xl p-1 max-w-md w-full">
              <div className="bg-gray-900 rounded-3xl p-6">
                <h2 className="text-2xl font-black text-white mb-4 text-center uppercase">End Tournament?</h2>
                <p className="text-gray-300 mb-6 text-center">Are you sure you want to end the tournament and clear all data? This cannot be undone.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-bold hover:bg-gray-600 uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEndTournament}
                    className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white py-3 rounded-xl font-bold hover:from-red-700 hover:to-red-800 uppercase"
                  >
                    End Tournament
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-600 rounded-3xl shadow-2xl p-1 mb-6">
          <div className="bg-gray-900 rounded-3xl p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <Trophy className="w-10 h-10 text-yellow-400 mr-3 animate-pulse" />
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 uppercase tracking-wider">
                      Victory Royale
                    </h1>
                    <p className="text-xs md:text-sm text-cyan-400 font-bold uppercase tracking-wider">
                      Match {currentRound} of {totalRounds}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-800 rounded-xl p-3 border-2 border-purple-500">
                  <p className="text-xs text-gray-400 font-bold uppercase text-center mb-1">Tournament Code</p>
                  <p className="text-2xl font-black text-white text-center tracking-widest">{passcode}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => setShowEndConfirm(true)}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 rounded-xl font-bold hover:from-red-700 hover:to-red-800 flex items-center justify-center shadow-lg uppercase text-sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  End Tournament
                </button>
                <button
                  onClick={copyToClipboard}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 flex items-center justify-center shadow-lg uppercase text-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Share
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-800 rounded-full h-4 border-2 border-purple-500">
              <div
                className="bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-500 shadow-lg"
                style={{ width: `${(currentRound / totalRounds) * 100}%` }}
              />
            </div>
          </div>
        </div>

       {/* Leaderboard */}
        <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-600 rounded-3xl shadow-2xl p-1 mb-6">
          <div className="bg-gray-900 rounded-3xl p-6 overflow-x-auto">
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-500 mb-4 flex items-center uppercase tracking-wider">
              <Target className="w-8 h-8 mr-2 text-yellow-400" />
              {tournamentComplete ? '🏆 Champions 🏆' : 'Leaderboard'}
            </h2>
            
            <div className="space-y-4">
              {leaderboard.map((player, index) => (
                <div
                  key={player.name}
                  className={`rounded-2xl overflow-hidden border-4 ${
                    index === 0 && tournamentComplete
                      ? 'border-yellow-400 bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 animate-pulse'
                      : 'border-purple-600 bg-gradient-to-br from-gray-800 to-gray-900'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <span className="text-4xl font-black mr-3">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                        </span>
                        <div>
                          <p className={`font-black text-xl uppercase tracking-wide ${
                            index === 0 && tournamentComplete ? 'text-gray-900' : 'text-white'
                          }`}>
                            {player.name}
                          </p>
                          <p className={`text-sm font-bold uppercase tracking-wider ${
                            index === 0 && tournamentComplete ? 'text-gray-800' : 'text-cyan-400'
                          }`}>
                            {Object.keys(player.rounds).length} / {totalRounds} matches
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-4xl font-black ${
                          index === 0 && tournamentComplete ? 'text-gray-900' : 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500'
                        }`}>
                          {player.total}
                        </p>
                        <p className={`text-xs font-bold uppercase tracking-wider ${
                          index === 0 && tournamentComplete ? 'text-gray-800' : 'text-gray-400'
                        }`}>
                          points
                        </p>
                      </div>
                    </div>
                    
                    {/* Round-by-round breakdown */}
                    <div className="mt-4 space-y-2">
                      {[...Array(totalRounds)].map((_, roundIdx) => {
                        const roundNum = roundIdx + 1;
                        const roundData = player.rounds[roundNum];
                        
                        if (!roundData) {
                          return (
                            <div key={roundNum} className="bg-gray-800 bg-opacity-50 rounded-xl p-3 text-sm text-gray-500 font-bold border-2 border-gray-700">
                              Match {roundNum}: Waiting to drop...
                            </div>
                          );
                        }
                        
                        return (
                          <div key={roundNum} className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-3 border-2 border-purple-600">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-black text-sm text-cyan-400 uppercase tracking-wider">Match {roundNum}</span>
                              <span className="font-black text-lg text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-500">
                                {roundData.total} PTS
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-2 border-2 border-blue-400">
                                <div className="text-blue-200 font-bold uppercase">Place</div>
                                <div className="font-black text-white text-lg">#{roundData.place}</div>
                                <div className="text-cyan-300 font-bold">{roundData.placePoints} pts</div>
                              </div>
                              <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-lg p-2 border-2 border-green-400">
                                <div className="text-green-200 font-bold uppercase">Elims</div>
                                <div className="font-black text-white text-lg">{roundData.elims}</div>
                                <div className="text-green-300 font-bold">{roundData.elimPoints} pts</div>
                              </div>
                              <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-lg p-2 border-2 border-red-400">
                                <div className="text-red-200 font-bold uppercase">Self</div>
                                <div className="font-black text-white text-lg">{roundData.selfElim ? '💀' : '✓'}</div>
                                <div className={`font-bold ${roundData.selfElim ? 'text-red-300' : 'text-gray-400'}`}>
                                  {roundData.selfElimPoints} pts
                                </div>
                              </div>
                              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg p-2 border-2 border-purple-400">
                                <div className="text-purple-200 font-bold uppercase">Total</div>
                                <div className="font-black text-yellow-300 text-lg">{roundData.total}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Score Input */}
        {!tournamentComplete && (
          <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-600 rounded-3xl shadow-2xl p-1 mb-6">
            <div className="bg-gray-900 rounded-3xl p-6">
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-4 flex items-center uppercase tracking-wider">
                <Users className="w-8 h-8 mr-2 text-cyan-400" />
                Submit Match {currentRound} Stats
              </h2>
              
              {!selectedPlayer ? (
                <div className="grid grid-cols-2 gap-3">
                  {playerNames.map(player => (
                    <button
                      key={player}
                      onClick={() => setSelectedPlayer(player)}
                      disabled={getRoundStatus(player, currentRound)}
                      className={`p-4 rounded-xl font-black text-lg uppercase tracking-wide transition transform hover:scale-105 shadow-lg border-4 ${
                        getRoundStatus(player, currentRound)
                          ? 'bg-gradient-to-r from-green-600 to-emerald-700 border-green-400 text-white cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white hover:from-purple-700 hover:to-pink-700'
                      }`}
                    >
                      {player}
                      {getRoundStatus(player, currentRound) && (
                        <div className="text-sm mt-1 font-bold">
                          ✓ Submitted
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xl font-black text-white mb-4 uppercase tracking-wider text-center">
                    🎮 {selectedPlayer} 🎮
                  </p>
                  
                  <div>
                    <label className="block text-sm font-black text-cyan-400 mb-2 uppercase tracking-wider">
                      🏆 Place Finished (1-100)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={placeInput}
                      onChange={(e) => setPlaceInput(e.target.value)}
                      placeholder="Enter placement"
                      className="w-full px-4 py-3 bg-gray-800 border-4 border-blue-500 text-white rounded-xl text-xl font-black focus:ring-4 focus:ring-cyan-400 focus:border-cyan-400 placeholder-gray-500"
                    />
                    {placeInput && (
                      <p className="text-sm text-cyan-400 mt-1 font-bold">
                        💎 Points: {calculatePlacePoints(placeInput)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-black text-cyan-400 mb-2 uppercase tracking-wider">
                      💀 Eliminations (0-100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={elimsInput}
                      onChange={(e) => setElimsInput(e.target.value)}
                      placeholder="Enter eliminations"
                      className="w-full px-4 py-3 bg-gray-800 border-4 border-green-500 text-white rounded-xl text-xl font-black focus:ring-4 focus:ring-green-400 focus:border-green-400 placeholder-gray-500"
                    />
                    {elimsInput && (
                      <p className="text-sm text-green-400 mt-1 font-bold">
                        💎 Points: {calculateElimPoints(elimsInput)} (1pt each up to 10, then 2pts each)
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-black text-cyan-400 mb-2 uppercase tracking-wider">
                      ☠️ Self Elimination?
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelfElimInput(false)}
                        className={`flex-1 py-4 rounded-xl font-black text-lg uppercase tracking-wider transition transform hover:scale-105 shadow-lg border-4 ${
                          !selfElimInput
                            ? 'bg-gradient-to-r from-green-600 to-emerald-700 border-green-400 text-white'
                            : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        ✓ No
                      </button>
                      <button
                        onClick={() => setSelfElimInput(true)}
                        className={`flex-1 py-4 rounded-xl font-black text-lg uppercase tracking-wider transition transform hover:scale-105 shadow-lg border-4 ${
                          selfElimInput
                            ? 'bg-gradient-to-r from-red-600 to-red-800 border-red-400 text-white'
                            : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        💀 Yes ({SELF_ELIM_PENALTY})
                      </button>
                    </div>
                  </div>

                  {placeInput && elimsInput && (
                    <div className="bg-gradient-to-r from-purple-800 to-pink-800 rounded-xl p-4 border-4 border-purple-400">
                      <p className="font-black text-cyan-400 mb-2 uppercase tracking-wider">Preview Total:</p>
                      <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-500">
                        {calculatePlacePoints(placeInput) + calculateElimPoints(elimsInput) + calculateSelfElimPoints(selfElimInput)} POINTS
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={submitScore}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-700 text-white py-4 rounded-xl font-black text-lg hover:from-green-700 hover:to-emerald-800 transition transform hover:scale-105 shadow-lg flex items-center justify-center uppercase tracking-wider border-4 border-green-400"
                    >
                      <Save className="w-6 h-6 mr-2" />
                      Submit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPlayer(null);
                        setPlaceInput('');
                        setElimsInput('');
                        setSelfElimInput(false);
                      }}
                      className="flex-1 bg-gray-800 text-white py-4 rounded-xl font-black text-lg hover:bg-gray-700 transition transform hover:scale-105 shadow-lg uppercase tracking-wider border-4 border-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {allRoundScoresSubmitted && currentRound < totalRounds && (
                <button
                  onClick={advanceRound}
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-black text-lg hover:from-blue-700 hover:to-cyan-700 transition transform hover:scale-105 shadow-lg flex items-center justify-center uppercase tracking-wider border-4 border-cyan-400"
                >
                  <RotateCcw className="w-6 h-6 mr-2" />
                  Next Match ({currentRound + 1})
                </button>
              )}

              {allRoundScoresSubmitted && currentRound === totalRounds && !tournamentComplete && (
                <button
                  onClick={advanceRound}
                  className="w-full mt-6 bg-gradient-to-r from-yellow-500 to-orange-600 text-white py-4 rounded-xl font-black text-lg hover:from-yellow-600 hover:to-orange-700 transition transform hover:scale-105 shadow-lg flex items-center justify-center uppercase tracking-wider border-4 border-yellow-400 animate-pulse"
                >
                  <Trophy className="w-6 h-6 mr-2" />
                  Victory Royale!
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
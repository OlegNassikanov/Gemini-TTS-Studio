
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceName, AudioState } from './types';
import { VOICE_OPTIONS } from './constants';
import { generateSpeech } from './services/geminiService';
import { bufferToWav } from './utils/audioHelper';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  const [text, setText] = useState('Привет! Я могу превратить любой текст в качественный звук. Если текст слишком длинный, я разделю его на части и озвучу их по очереди, чтобы сохранить естественный темп речи.');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Kore);
  const [state, setState] = useState<AudioState>({
    isProcessing: false,
    isPlaying: false,
    error: null,
    audioBuffer: null,
    progress: { current: 0, total: 0 }
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyserNodeRef.current = analyser;
      setAnalyser(analyser);
    }
    return audioContextRef.current;
  };

  const handleStop = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const handlePlay = useCallback(() => {
    const ctx = initAudioContext();
    if (!state.audioBuffer || !analyserNodeRef.current) return;

    if (state.isPlaying) {
      handleStop();
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = state.audioBuffer;
    source.connect(analyserNodeRef.current);
    analyserNodeRef.current.connect(ctx.destination);
    
    source.onended = () => {
      setState(prev => ({ ...prev, isPlaying: false }));
    };

    source.start(0);
    sourceNodeRef.current = source;
    setState(prev => ({ ...prev, isPlaying: true }));
  }, [state.audioBuffer, state.isPlaying, handleStop]);

  const handleGenerate = async () => {
    if (!text.trim()) return;

    handleStop();
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      error: null, 
      audioBuffer: null,
      progress: { current: 0, total: 0 } 
    }));

    try {
      const ctx = initAudioContext();
      const buffer = await generateSpeech(text, selectedVoice, ctx, (current, total) => {
        setState(prev => ({ ...prev, progress: { current, total } }));
      });
      setState(prev => ({ ...prev, isProcessing: false, audioBuffer: buffer }));
    } catch (err: any) {
      console.error(err);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: err.message || 'Ошибка генерации речи' 
      }));
    }
  };

  const handleDownload = () => {
    if (!state.audioBuffer) return;
    const wavBlob = bufferToWav(state.audioBuffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-speech-${selectedVoice.toLowerCase()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progressPercentage = state.progress && state.progress.total > 0 
    ? (state.progress.current / state.progress.total) * 100 
    : 0;

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="max-w-4xl w-full mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
          Gemini TTS Studio
        </h1>
        <p className="text-slate-400">Стабильная озвучка длинных текстов через ИИ</p>
      </header>

      <main className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="glass rounded-2xl p-6 shadow-2xl">
            <label className="block text-sm font-medium text-slate-400 mb-2">Ваш текст</label>
            <textarea
              className="w-full h-48 bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-all"
              placeholder="Введите здесь текст для озвучки..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            
            {state.isProcessing && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Обработка фрагмента {state.progress?.current} из {state.progress?.total}</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full transition-all duration-300" 
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-4">
              <span className="text-xs text-slate-500">{text.length} символов</span>
              <button
                onClick={handleGenerate}
                disabled={state.isProcessing || !text.trim()}
                className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                  state.isProcessing 
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                }`}
              >
                {state.isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                    Синтез...
                  </>
                ) : (
                  'Сгенерировать звук'
                )}
              </button>
            </div>
          </section>

          <section className="glass rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Аудиовыход</h3>
              {state.audioBuffer && (
                <button 
                  onClick={handleDownload}
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Скачать WAV
                </button>
              )}
            </div>
            
            <AudioVisualizer analyser={state.isPlaying ? analyser : null} isProcessing={state.isProcessing} />

            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={handlePlay}
                disabled={!state.audioBuffer}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  !state.audioBuffer 
                    ? 'bg-slate-800 text-slate-600' 
                    : 'bg-white text-slate-900 hover:scale-105 active:scale-95 shadow-xl'
                }`}
              >
                {state.isPlaying ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {state.isPlaying ? 'Воспроизведение...' : state.audioBuffer ? 'Аудио склеено и готово' : 'Ожидание генерации'}
                </div>
                {state.audioBuffer && (
                  <div className="text-xs text-slate-400 mt-1">
                    Длительность: {state.audioBuffer.duration.toFixed(2)}с | {state.progress?.total} сегментов
                  </div>
                )}
              </div>
            </div>
          </section>

          {state.error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
              Ошибка: {state.error}
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 flex flex-col gap-6">
          <section className="glass rounded-2xl p-6 shadow-2xl h-fit">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Выбор голоса
            </h3>
            <div className="space-y-3">
              {VOICE_OPTIONS.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedVoice === voice.id
                      ? 'bg-blue-600/10 border-blue-500/50 shadow-inner ring-1 ring-blue-500/50'
                      : 'bg-slate-900/30 border-slate-700/50 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-100">{voice.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${voice.gender === 'Male' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}`}>
                      {voice.gender === 'Male' ? 'М' : 'Ж'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{voice.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-6 shadow-2xl h-fit">
            <h3 className="font-bold mb-4">Челночный механизм</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Для больших текстов мы используем сегментацию по 500 символов. Это предотвращает "эффект ускорения" и сохраняет качество интонаций на протяжении всего аудиофайла.
            </p>
          </section>
        </aside>
      </main>

      <footer className="mt-12 text-slate-500 text-sm">
        &copy; 2024 Gemini TTS Studio | Работает на базе Google AI
      </footer>
    </div>
  );
};

export default App;

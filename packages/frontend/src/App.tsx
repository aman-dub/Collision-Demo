import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

/* ─── Types ─── */
interface LyricLine {
  id: string;
  text: string;
  time?: number;
  previousText?: string;
}

interface Note {
  id: string;
  time: number;
  text: string;
  createdAt: string;
  authorName: string;
  authorRole: 'Editor' | 'Viewer';
  sampleUrl?: string;
}

interface Sample {
  id: string;
  name: string;
  audioUrl: string;
  notes: Note[];
  lyrics: LyricLine[];
  tempo?: number;
  keySignature?: string;
}

interface Project {
  id: string;
  name: string;
  samples: Sample[];
  expanded: boolean;
  ownerId: string;
  collaborators: { userId: string; userName: string; role: 'Editor' | 'Viewer' }[];
}

/* ─── Utility ─── */
const uid = () => Math.random().toString(36).slice(2, 10);
const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
};

/* ─── Initial Data ─── */
const INITIAL_PROJECTS: Project[] = [
  {
    id: uid(),
    name: 'Demo Project',
    expanded: true,
    ownerId: 'u1',
    collaborators: [],
    samples: [
      {
        id: uid(),
        name: 'Mixdown v1',
        audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        tempo: 120,
        keySignature: 'C Minor',
        lyrics: [
          { id: uid(), text: 'Verse 1: Walking down the street' },
          { id: uid(), text: 'Looking at the sky', time: 10.5, previousText: 'Staring at the sky' },
          { id: uid(), text: 'Chorus: Oh yeah' },
        ],
        notes: [
          { id: uid(), time: 12.5, text: 'Sub-bass feels too heavy here — try pulling back 2dB.', createdAt: new Date(Date.now() - 3600000).toISOString(), authorName: 'Aman (Admin)', authorRole: 'Editor' },
        ],
      }
    ],
  },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Waveform Player Component
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface PlayerRef {
  seekTo: (time: number) => void;
}

const WaveformPlayer = forwardRef<PlayerRef, {
  audioUrl: string;
  sampleName: string;
  tempo?: number;
  keySignature?: string;
  onTimeUpdate: (t: number) => void;
  currentTimeRef: React.MutableRefObject<number>;
}>(({ audioUrl, sampleName, tempo, keySignature, onTimeUpdate, currentTimeRef }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const activeRegionRef = useRef<any>(null);
  const isInteractingRef = useRef(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const [isLooping, setIsLooping] = useState(false);

  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      if (wsRef.current) wsRef.current.setTime(time);
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#c8c4b8',
      progressColor: '#1a1a1a',
      cursorColor: '#556b2f',
      cursorWidth: 1.5,
      height: 80,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());
    regions.enableDragSelection({ color: 'rgba(85, 107, 47, 0.25)' });

    regions.on('region-created', (region) => {
      regions.getRegions().forEach(r => { if (r !== region) r.remove(); });
      activeRegionRef.current = region;
    });

    regions.on('region-updated', (region) => { activeRegionRef.current = region; });
    regions.on('region-clicked', (region, e) => { e.stopPropagation(); region.play(); });

    ws.on('interaction', () => {
      isInteractingRef.current = true;
      setTimeout(() => { isInteractingRef.current = false; }, 300);
    });

    ws.load(audioUrl);
    ws.on('ready', () => setDuration(ws.getDuration()));
    ws.on('timeupdate', (t: number) => {
      setDisplayTime(t);
      currentTimeRef.current = t;
      onTimeUpdate(t);
    });
    
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    wsRef.current = ws;
    return () => { ws.destroy(); wsRef.current = null; activeRegionRef.current = null; };
  }, [audioUrl, onTimeUpdate]); 

  useEffect(() => {
    let rafId: number;
    const enforceLoop = () => {
      if (wsRef.current && isPlaying && isLooping && activeRegionRef.current && !isInteractingRef.current) {
        const t = wsRef.current.getCurrentTime();
        const r = activeRegionRef.current;
        if (t >= r.end - 0.05) {
          wsRef.current.setTime(r.start);
        }
      }
      rafId = requestAnimationFrame(enforceLoop);
    };
    if (isPlaying && isLooping) {
      rafId = requestAnimationFrame(enforceLoop);
    }
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isLooping]);

  const togglePlay = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.playPause();
  }, []);

  const toggleLoop = () => setIsLooping(!isLooping);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  return (
    <div className="player-bar">
      <div className="player-inner">
        <div className="player-title">{sampleName}</div>
        <div className="player-meta">
          <span className="player-meta-badge">BPM: {tempo || '--'}</span>
          <span className="player-meta-badge">Key: {keySignature || '--'}</span>
        </div>
        
        <div className="waveform-wrap">
          <div ref={containerRef} className="waveform-container" />
        </div>
        
        <div className="player-controls">
          <div className="controls-left">
            <button className="play-btn" onClick={togglePlay} title="Play/Pause (Space)">
              {isPlaying ? '❚❚' : '▶'}
            </button>
            <button 
              className={`loop-btn ${isLooping ? 'active' : ''}`} 
              onClick={toggleLoop}
            >
              Loop {isLooping ? 'ON' : 'OFF'}
            </button>
            <span className="time-display">{formatTime(displayTime)} / {formatTime(duration)}</span>
          </div>
          <div className="loop-hint">Click & drag on the waveform to create a loop</div>
        </div>
      </div>
    </div>
  );
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   App
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
type SimulatedUser = { id: string; name: string; role: 'Editor' | 'Viewer' };
const USERS: SimulatedUser[] = [
  { id: 'u1', name: 'Aman (Admin)', role: 'Editor' },
  { id: 'u2', name: 'Bob (Collaborator)', role: 'Editor' },
  { id: 'u3', name: 'Charlie (Client)', role: 'Viewer' },
];

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('collision_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate old data that may be missing ownerId/collaborators
        return parsed.map((p: any) => ({
          ...p,
          ownerId: p.ownerId || 'u1',
          collaborators: p.collaborators || [],
        }));
      } catch {
        return INITIAL_PROJECTS;
      }
    }
    return INITIAL_PROJECTS;
  });
  const [activeSampleId, setActiveSampleId] = useState<string | null>(() => {
    const saved = localStorage.getItem('collision_projects');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0 && parsed[0].samples.length > 0) {
        return parsed[0].samples[0].id;
      }
    }
    return INITIAL_PROJECTS[0].samples[0].id;
  });
  const [activeUser, setActiveUser] = useState<SimulatedUser>(USERS[0]);
  const [noteText, setNoteText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  const currentTimeRef = useRef(0);
  const handleTimeUpdate = useCallback((t: number) => {
    currentTimeRef.current = t;
  }, []);
  const playerRef = useRef<PlayerRef>(null);
  const broadcastChannel = useRef<BroadcastChannel | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const noteFileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [focusedLyricText, setFocusedLyricText] = useState<{ id: string, text: string } | null>(null);
  const lyricInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const [modal, setModal] = useState<{ 
    type: 'project' | 'sample' | 'invite' | 'delete_project' | 'delete_sample'; 
    projectId?: string;
    sampleId?: string;
  } | null>(null);
  const [modalInput, setModalInput] = useState('');
  const [inviteRole, setInviteRole] = useState<'Editor' | 'Viewer'>('Editor');
  const [inviteLink, setInviteLink] = useState('');
  const [selectedInviteUser, setSelectedInviteUser] = useState<string>('u2');
  
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [editingSampleName, setEditingSampleName] = useState('');

  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    type: 'project' | 'sample'; 
    targetId: string; 
    projectId?: string;
  } | null>(null);

  // Setup BroadcastChannel for sync
  useEffect(() => {
    broadcastChannel.current = new BroadcastChannel('collision_sync');
    broadcastChannel.current.onmessage = (e) => {
      if (e.data.type === 'sync_projects') {
        setProjects(e.data.projects);
      }
    };
    return () => broadcastChannel.current?.close();
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('collision_projects', JSON.stringify(projects));
  }, [projects]);

  // Wrapper for syncing state automatically
  const updateProjects = (updater: Project[] | ((prev: Project[]) => Project[])) => {
    setProjects(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next !== prev) {
        broadcastChannel.current?.postMessage({ type: 'sync_projects', projects: next });
      }
      return next;
    });
  };

  const activeSample = (() => {
    for (const p of projects) {
      for (const s of p.samples) {
        if (s.id === activeSampleId) return s;
      }
    }
    return null;
  })();

  const activeProject = (() => {
    for (const p of projects) {
      for (const s of p.samples) {
        if (s.id === activeSampleId) return p;
      }
    }
    return null;
  })();

  const visibleProjects = projects.filter(p => 
    p.ownerId === activeUser.id || p.collaborators?.some(c => c.userId === activeUser.id)
  );

  // Auto-deselect sample if current switches to a project user cannot access
  useEffect(() => {
    if (activeSampleId) {
      const isVisible = visibleProjects.some(p => p.samples.some(s => s.id === activeSampleId));
      if (!isVisible) {
        const firstSample = visibleProjects.length > 0 && visibleProjects[0].samples.length > 0 
          ? visibleProjects[0].samples[0].id 
          : null;
        setActiveSampleId(firstSample);
      }
    }
  }, [activeUser, projects]);

  const isEditor = activeUser.role === 'Editor';

  // ── Project actions ──
  const toggleProject = (id: string) => updateProjects(prev => prev.map(p => p.id === id ? { ...p, expanded: !p.expanded } : p));
  const addProject = (name: string) => updateProjects(prev => [...prev, { id: uid(), name, samples: [], expanded: true, ownerId: activeUser.id, collaborators: [] }]);
  const deleteProject = (id: string) => {
    updateProjects(prev => prev.filter(p => p.id !== id));
    if (activeProject?.id === id) setActiveSampleId(null);
  };
  const renameProject = (id: string, newName: string) => {
    if (!newName.trim()) return;
    updateProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName.trim() } : p));
  };
  
  // ── Sample actions ──
  const addSampleToProject = (projectId: string, name: string, audioUrl: string) => {
    const mockTempo = Math.floor(Math.random() * (140 - 80) + 80);
    const mockKeys = ['C Major', 'A Minor', 'G Major', 'E Minor'];
    const s: Sample = { 
      id: uid(), name, audioUrl, notes: [], 
      lyrics: [{ id: uid(), text: '' }],
      tempo: mockTempo, keySignature: mockKeys[Math.floor(Math.random() * mockKeys.length)]
    };
    updateProjects(prev => prev.map(p => p.id === projectId ? { ...p, samples: [...p.samples, s], expanded: true } : p));
    setActiveSampleId(s.id);
  };

  const deleteSample = (projectId: string, sampleId: string) => {
    updateProjects(prev => prev.map(p => p.id === projectId ? { ...p, samples: p.samples.filter(s => s.id !== sampleId) } : p));
    if (activeSampleId === sampleId) setActiveSampleId(null);
  };

  const renameSample = (projectId: string, sampleId: string, newName: string) => {
    if (!newName.trim()) return;
    updateProjects(prev => prev.map(p => p.id === projectId ? {
      ...p,
      samples: p.samples.map(s => s.id === sampleId ? { ...s, name: newName.trim() } : s)
    } : p));
  };

  const handleFileUpload = (projectId: string, file: File) => {
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^/.]+$/, '');
    addSampleToProject(projectId, name, url);
  };

  // ── Note actions ──
  const addNote = useCallback(() => {
    if ((!noteText.trim() && !audioFile) || !activeSampleId || !activeProject) return;
    
    let sampleUrl: string | undefined = undefined;
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      sampleUrl = url;
      // Add as sample to project
      const newSample: Sample = {
        id: uid(),
        name: `Audio Idea - ${audioFile.name.replace(/\.[^/.]+$/, '')}`,
        audioUrl: url,
        notes: [],
        lyrics: [{ id: uid(), text: '' }],
        tempo: 120,
        keySignature: 'C Major'
      };
      updateProjects(prev => prev.map(p => p.id === activeProject.id ? {
        ...p, samples: [...p.samples, newSample]
      } : p));
      setAudioFile(null);
    }

    const note: Note = {
      id: uid(),
      time: currentTimeRef.current,
      text: noteText.trim() || 'Attached audio idea.',
      createdAt: new Date().toISOString(),
      authorName: activeUser.name,
      authorRole: activeUser.role,
      sampleUrl
    };

    updateProjects(prev => prev.map(p => ({
      ...p, samples: p.samples.map(s => s.id === activeSampleId ? { ...s, notes: [...s.notes, note] } : s),
    })));
    setNoteText('');
  }, [noteText, activeSampleId, activeUser, audioFile, activeProject]);

  const removeNote = (noteId: string) => {
    if (!activeSampleId || !isEditor) return;
    updateProjects(prev => prev.map(p => ({
      ...p, samples: p.samples.map(s => s.id === activeSampleId ? { ...s, notes: s.notes.filter(n => n.id !== noteId) } : s),
    })));
  };

  const handleSeek = (time: number) => {
    if (playerRef.current) playerRef.current.seekTo(time);
  };

  // ── Lyrics actions ──
  const sortLyrics = (lyrics: LyricLine[]) => {
    let currentT = -1;
    const sorted = lyrics.map((l, i) => {
      if (l.time !== undefined) currentT = l.time;
      return { ...l, sortTime: currentT, originalIndex: i };
    });
    sorted.sort((a, b) => {
      if (a.sortTime !== b.sortTime) return a.sortTime - b.sortTime;
      return a.originalIndex - b.originalIndex;
    });
    return sorted.map(l => { const { sortTime, originalIndex, ...rest } = l; return rest as LyricLine; });
  };

  const updateLyricState = (updater: (lyrics: LyricLine[]) => LyricLine[]) => {
    updateProjects(prev => prev.map(p => ({
      ...p, samples: p.samples.map(s => {
        if (s.id !== activeSampleId) return s;
        return { ...s, lyrics: sortLyrics(updater(s.lyrics)) };
      })
    })));
  };

  const handleLyricKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number, lyric: LyricLine) => {
    if (!isEditor || !activeSample) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const newId = uid();
      const input = e.currentTarget;
      const cursor = input.selectionStart || 0;
      
      updateLyricState(lyrics => {
        const newLyrics = [...lyrics];
        const textBefore = lyric.text.slice(0, cursor);
        const textAfter = lyric.text.slice(cursor);
        newLyrics[idx] = { ...lyric, text: textBefore };
        newLyrics.splice(idx + 1, 0, { id: newId, text: textAfter });
        return newLyrics;
      });
      setTimeout(() => lyricInputRefs.current[newId]?.focus(), 10);
    } 
    else if (e.key === 'Backspace') {
      const input = e.currentTarget;
      if (input.selectionStart === 0 && input.selectionEnd === 0) {
        e.preventDefault();
        if (lyric.time !== undefined) {
          updateLyricState(lyrics => lyrics.map(l => l.id === lyric.id ? { ...l, time: undefined } : l));
        } else if (idx > 0) {
          const prevLyric = activeSample.lyrics[idx - 1];
          const newCursorPos = prevLyric.text.length;
          updateLyricState(lyrics => {
            const newLyrics = [...lyrics];
            newLyrics[idx - 1] = { ...prevLyric, text: prevLyric.text + lyric.text };
            newLyrics.splice(idx, 1);
            return newLyrics;
          });
          setTimeout(() => {
            const prevInput = lyricInputRefs.current[prevLyric.id];
            if (prevInput) {
              prevInput.focus();
              prevInput.setSelectionRange(newCursorPos, newCursorPos);
            }
          }, 10);
        }
      }
    }
  };

  const handleLyricBlur = (lyric: LyricLine) => {
    if (focusedLyricText && focusedLyricText.id === lyric.id && focusedLyricText.text !== lyric.text) {
      updateLyricState(lyrics => lyrics.map(l => 
        l.id === lyric.id ? { ...l, previousText: focusedLyricText.text } : l
      ));
    }
    setFocusedLyricText(null);
  };

  const exportLyrics = () => {
    if (!activeSample) return;
    const txt = activeSample.lyrics.map(l => {
      const ts = l.time !== undefined ? `[${formatTime(l.time)}] ` : '';
      return `${ts}${l.text}`;
    }).join('\n');
    
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSample.name} - Lyrics.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Modals & Context Menus ──
  const confirmModal = () => {
    if (modal?.type === 'invite' && activeProject) {
      const selectedUserObj = USERS.find(u => u.id === selectedInviteUser);
      if (selectedUserObj) {
        updateProjects(prev => prev.map(p => p.id === activeProject.id ? {
          ...p,
          collaborators: [
            ...(p.collaborators || []).filter(c => c.userId !== selectedInviteUser),
            { userId: selectedUserObj.id, userName: selectedUserObj.name, role: inviteRole }
          ]
        } : p));
      }
      closeModal();
      return;
    }
    if (modal?.type === 'delete_project' && modal.projectId) {
      deleteProject(modal.projectId);
      closeModal();
      return;
    }
    if (modal?.type === 'delete_sample' && modal.projectId && modal.sampleId) {
      deleteSample(modal.projectId, modal.sampleId);
      closeModal();
      return;
    }
    if (!modalInput.trim()) return;
    if (modal?.type === 'project') addProject(modalInput.trim());
    else if (modal?.type === 'sample' && modal.projectId) addSampleToProject(modal.projectId, modalInput.trim(), '');
    closeModal();
  };

  const closeModal = () => { setModal(null); setModalInput(''); setInviteLink(''); };

  // Close context menu on click outside
  useEffect(() => {
    const closeCtx = () => setContextMenu(null);
    window.addEventListener('click', closeCtx);
    return () => window.removeEventListener('click', closeCtx);
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <h1>Collision</h1>
          {isEditor && activeProject && (
            <button className="header-btn" onClick={() => { setModal({ type: 'invite' }); setInviteLink(''); }}>
              Invite Collaborator
            </button>
          )}
          <button className="header-btn pro-btn" onClick={() => alert("Thank you for your interest! Pro subscription flow coming soon.")}>
            Get Pro
          </button>
          <button className="header-btn signout-btn" onClick={() => alert("Signed out successfully.")}>
            Sign Out
          </button>
        </div>
        
        <div className="header-right">
          <select 
            className="role-select" 
            value={activeUser.id} 
            onChange={e => setActiveUser(USERS.find(u => u.id === e.target.value) || USERS[0])}
          >
            {USERS.map(u => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
          </select>
        </div>
      </header>

      <div className="app-layout">
        {/* ── Left Sidebar ── */}
        <nav className="sidebar">
          <div className="sidebar-header"><h2>Workspace Projects</h2></div>
          <div className="sidebar-scroll">
            {visibleProjects.map(project => (
              <div className="project-group" key={project.id}>
                {editingProjectId === project.id ? (
                  <input
                    className="inline-edit-input"
                    value={editingProjectName}
                    autoFocus
                    onChange={e => setEditingProjectName(e.target.value)}
                    onBlur={() => { renameProject(project.id, editingProjectName); setEditingProjectId(null); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { renameProject(project.id, editingProjectName); setEditingProjectId(null); }
                    }}
                  />
                ) : (
                  <button
                    className={`project-btn ${activeProject?.id === project.id ? 'active' : ''}`}
                    onClick={() => toggleProject(project.id)}
                    onDoubleClick={() => { if (isEditor) { setEditingProjectId(project.id); setEditingProjectName(project.name); } }}
                    onContextMenu={e => {
                      if (!isEditor) return;
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, type: 'project', targetId: project.id });
                    }}
                    onKeyDown={e => {
                      if (!isEditor) return;
                      if (e.key === 'Delete' || e.key === 'Backspace') {
                        setModal({ type: 'delete_project', projectId: project.id });
                      }
                    }}
                  >
                    <span className={`project-chevron ${project.expanded ? 'open' : ''}`}>▸</span>
                    {project.name}
                  </button>
                )}

                {project.expanded && (
                  <div className="sample-list">
                    {project.samples.map(sample => (
                      <div key={sample.id} style={{ display: 'flex', flexDirection: 'column' }}>
                        {editingSampleId === sample.id ? (
                          <input
                            className="inline-edit-input"
                            style={{ marginLeft: 16, width: 'calc(100% - 16px)' }}
                            value={editingSampleName}
                            autoFocus
                            onChange={e => setEditingSampleName(e.target.value)}
                            onBlur={() => { renameSample(project.id, sample.id, editingSampleName); setEditingSampleId(null); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { renameSample(project.id, sample.id, editingSampleName); setEditingSampleId(null); }
                            }}
                          />
                        ) : (
                          <button
                            className={`sample-btn ${sample.id === activeSampleId ? 'active' : ''}`}
                            onClick={() => setActiveSampleId(sample.id)}
                            onDoubleClick={() => { if (isEditor) { setEditingSampleId(sample.id); setEditingSampleName(sample.name); } }}
                            onContextMenu={e => {
                              if (!isEditor) return;
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({ x: e.clientX, y: e.clientY, type: 'sample', targetId: sample.id, projectId: project.id });
                            }}
                            onKeyDown={e => {
                              if (!isEditor) return;
                              if (e.key === 'Delete' || e.key === 'Backspace') {
                                setModal({ type: 'delete_sample', projectId: project.id, sampleId: sample.id });
                              }
                            }}
                          >
                            <span className="sample-icon" />{sample.name}
                          </button>
                        )}
                      </div>
                    ))}
                    {isEditor && (
                      <label className="sidebar-add-btn">
                        <span>＋</span> Add audio file
                        <input
                          className="hidden-input" type="file" accept="audio/*"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(project.id, f); e.target.value = ''; }}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isEditor && (
              <button className="sidebar-add-btn" onClick={() => { setModal({ type: 'project' }); setModalInput(''); }}>
                <span>＋</span> New project
              </button>
            )}
          </div>
        </nav>

        {/* ── Center Content ── */}
        <div className="center-content">
          {activeSample ? (
            <>
              {activeSample.audioUrl && (
                <WaveformPlayer
                  ref={playerRef}
                  key={activeSample.id}
                  audioUrl={activeSample.audioUrl}
                  sampleName={`${activeProject?.name} / ${activeSample.name}`}
                  tempo={activeSample.tempo}
                  keySignature={activeSample.keySignature}
                  onTimeUpdate={handleTimeUpdate}
                  currentTimeRef={currentTimeRef}
                />
              )}

              {/* Lyrics Section */}
              <div className="lyrics-area">
                <div className="lyrics-inner">
                  <div className="lyrics-header-row">
                    <div className="lyrics-header" style={{ marginBottom: 0 }}>Lyrics</div>
                    <button className="export-btn" onClick={exportLyrics}>Export .txt</button>
                  </div>
                  
                  {activeSample.lyrics.map((lyric, idx) => (
                    <div key={lyric.id} className={`lyric-line ${!isEditor ? 'read-only' : ''}`}>
                      {lyric.time !== undefined ? (
                        <span 
                          className="lyric-timestamp" 
                          onClick={() => handleSeek(lyric.time!)}
                          title="Seek to time"
                        >
                          {formatTime(lyric.time)}
                        </span>
                      ) : (
                        <span 
                          className={`lyric-add-ts ${!isEditor ? 'invisible' : ''}`}
                          onClick={() => updateLyricState(lyrics => lyrics.map(l => l.id === lyric.id ? { ...l, time: currentTimeRef.current } : l))}
                          title="Add timestamp"
                        >
                          + 0:00
                        </span>
                      )}
                      
                      <div className="lyric-input-wrap">
                        {lyric.previousText && (
                          <span className="lyric-strike">{lyric.previousText}</span>
                        )}
                        <input
                          ref={el => { lyricInputRefs.current[lyric.id] = el; }}
                          className="lyric-input"
                          value={lyric.text}
                          onFocus={() => setFocusedLyricText({ id: lyric.id, text: lyric.text })}
                          onBlur={() => handleLyricBlur(lyric)}
                          onChange={(e) => updateLyricState(lyrics => lyrics.map(l => l.id === lyric.id ? { ...l, text: e.target.value } : l))}
                          onKeyDown={(e) => handleLyricKeyDown(e, idx, lyric)}
                          placeholder="Type lyrics here..."
                        />
                      </div>
                    </div>
                  ))}
                  {activeSample.lyrics.length === 0 && isEditor && (
                    <button onClick={() => updateLyricState(l => [...l, { id: uid(), text: '' }])} style={{ background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 13 }}>
                      + Add Lyrics
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ height: '100%' }}>
              <span className="empty-icon">🎵</span><p>Select a sample from the sidebar to get started.</p>
            </div>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div className="right-sidebar">
          {activeSample && (
            <>
              <div className="notes-header">
                <h2>Comments</h2>
                <span className="notes-count">{activeSample.notes.length} comment{activeSample.notes.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="notes-scroll">
                {activeSample.notes.length === 0 && (
                  <div className="empty-state" style={{ padding: 20 }}>
                    <p style={{ textAlign: 'center' }}>No comments yet.</p>
                  </div>
                )}
                {activeSample.notes.slice().sort((a, b) => a.time - b.time).map(note => (
                  <div className="note-card" key={note.id}>
                    <div className="note-meta">
                      <div className="note-author-info">
                        <span className="note-author">{note.authorName}</span>
                        <span className={`note-role role-${note.authorRole}`}>{note.authorRole}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="note-timestamp" onClick={() => handleSeek(note.time)}>
                          {formatTime(note.time)}
                        </span>
                        {isEditor && (
                          <button className="note-delete" onClick={() => removeNote(note.id)}>×</button>
                        )}
                      </div>
                    </div>
                    <div className="note-text">{note.text}</div>
                    {note.sampleUrl && (
                      <div className="note-audio-player">
                        <audio src={note.sampleUrl} controls />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="note-composer">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Write a comment or audio idea..."
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) { e.preventDefault(); addNote(); } }}
                />
                
                {audioFile && (
                  <div className="composer-attachment-preview">
                    <span>📎 Audio Idea: {audioFile.name}</span>
                    <button className="composer-attachment-remove" onClick={() => setAudioFile(null)}>×</button>
                  </div>
                )}

                <div className="composer-footer">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button 
                      className="composer-attach-btn" 
                      onClick={() => noteFileInputRef.current?.click()} 
                      title="Attach audio idea"
                    >
                      📎
                    </button>
                    <input 
                      type="file" 
                      ref={noteFileInputRef} 
                      style={{ display: 'none' }} 
                      accept="audio/*"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) setAudioFile(f);
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="composer-hint">Enter to save</span>
                    <button className="composer-submit" disabled={!noteText.trim() && !audioFile} onClick={addNote}>
                      Add Note
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <button 
            className="context-item" 
            onClick={() => {
              if (contextMenu.type === 'project') {
                const p = projects.find(pr => pr.id === contextMenu.targetId);
                if (p) { setEditingProjectId(p.id); setEditingProjectName(p.name); }
              } else if (contextMenu.type === 'sample' && contextMenu.projectId) {
                const p = projects.find(pr => pr.id === contextMenu.projectId);
                const s = p?.samples.find(sm => sm.id === contextMenu.targetId);
                if (s) { setEditingSampleId(s.id); setEditingSampleName(s.name); }
              }
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button 
            className="context-item danger" 
            onClick={() => {
              if (contextMenu.type === 'project') {
                setModal({ type: 'delete_project', projectId: contextMenu.targetId });
              } else if (contextMenu.type === 'sample' && contextMenu.projectId) {
                setModal({ type: 'delete_sample', projectId: contextMenu.projectId, sampleId: contextMenu.targetId });
              }
              setContextMenu(null);
            }}
          >
            Delete...
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            {modal.type === 'invite' && activeProject ? (
              <>
                <h3>Invite to: {activeProject.name}</h3>
                <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>
                  Invite a collaborator to this project. They will only see this project in their workspace.
                </p>
                
                <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Select User to Invite</label>
                <select 
                  className="modal-select" 
                  value={selectedInviteUser} 
                  onChange={e => setSelectedInviteUser(e.target.value)}
                  style={{ marginBottom: 12 }}
                >
                  {USERS.filter(u => u.id !== activeUser.id).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>

                <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>Access Level</label>
                <select className="modal-select" value={inviteRole} onChange={e => setInviteRole(e.target.value as 'Editor' | 'Viewer')}>
                  <option value="Editor">Editor - Can edit everything</option>
                  <option value="Viewer">Viewer - Can only comment</option>
                </select>
                
                <div className="modal-actions" style={{ marginTop: 16 }}>
                  <button className="modal-cancel" onClick={closeModal}>Close</button>
                  <button className="modal-confirm" onClick={confirmModal}>Add to Project</button>
                </div>
              </>
            ) : modal.type === 'delete_project' ? (
              <>
                <h3>Delete Project</h3>
                <p style={{ fontSize: 13, color: 'var(--black)', marginBottom: 20 }}>
                  Are you sure you want to delete this project? This action cannot be undone.
                </p>
                <div className="modal-actions">
                  <button className="modal-cancel" onClick={closeModal}>Cancel</button>
                  <button className="modal-confirm" style={{ background: '#c0392b' }} onClick={confirmModal}>Delete</button>
                </div>
              </>
            ) : modal.type === 'delete_sample' ? (
              <>
                <h3>Delete Sample</h3>
                <p style={{ fontSize: 13, color: 'var(--black)', marginBottom: 20 }}>
                  Are you sure you want to delete this sample? This action cannot be undone.
                </p>
                <div className="modal-actions">
                  <button className="modal-cancel" onClick={closeModal}>Cancel</button>
                  <button className="modal-confirm" style={{ background: '#c0392b' }} onClick={confirmModal}>Delete</button>
                </div>
              </>
            ) : (
              <>
                <h3>{modal.type === 'project' ? 'New Project' : 'New Sample'}</h3>
                <input
                  className="modal-input" type="text" placeholder={modal.type === 'project' ? 'Project name' : 'Sample name'}
                  value={modalInput} onChange={e => setModalInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmModal(); }} autoFocus
                />
                <div className="modal-actions">
                  <button className="modal-cancel" onClick={closeModal}>Cancel</button>
                  <button className="modal-confirm" onClick={confirmModal}>Create</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

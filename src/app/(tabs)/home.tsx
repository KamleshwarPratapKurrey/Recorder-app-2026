import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface RecordingItem {
  id: string;
  uri: string;
  name: string;
  duration: string;
}

const STORAGE_KEY = "@voice_recorder_recordings";

export default function HomeScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Animation drivers for the waveform
  const waveAnim1 = useRef(new Animated.Value(1)).current;
  const waveAnim2 = useRef(new Animated.Value(1)).current;
  const waveAnim3 = useRef(new Animated.Value(1)).current;

  // Load recordings on mount
  useEffect(() => {
    async function loadRecordings() {
      try {
        const savedRecordings = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedRecordings) {
          setRecordings(JSON.parse(savedRecordings));
        }
      } catch (error) {
        console.error("Failed to load recordings:", error);
      }
    }

    async function getPermission() {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Microphone access is required to record audio.",
        );
      }
    }

    getPermission();
    loadRecordings();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Handle Waveform Animation Loop
  useEffect(() => {
    let animationLoop: Animated.CompositeAnimation;

    if (isRecording && !isPaused) {
      const createWaveSequence = (
        animVar: Animated.Value,
        duration: number,
      ) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(animVar, {
              toValue: 2.5,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(animVar, {
              toValue: 0.8,
              duration,
              useNativeDriver: true,
            }),
          ]),
        );
      };

      animationLoop = Animated.parallel([
        createWaveSequence(waveAnim1, 400),
        createWaveSequence(waveAnim2, 550),
        createWaveSequence(waveAnim3, 470),
      ]);

      animationLoop.start();
    } else {
      waveAnim1.setValue(1);
      waveAnim2.setValue(1);
      waveAnim3.setValue(1);
    }

    return () => {
      if (animationLoop) animationLoop.stop();
    };
  }, [isRecording, isPaused]);

  const formatDuration = (millis: number): string => {
    const minutes = Math.floor(millis / 60000);
    const seconds = ((millis % 60000) / 1000).toFixed(0);
    return `${minutes}:${Number(seconds) < 10 ? "0" : ""}${seconds}`;
  };

  const getFormattedDateTime = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
  };

  async function handleRecordPress() {
    try {
      if (!isRecording) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        setRecording(newRecording);
        setIsRecording(true);
        setIsPaused(false);
      } else {
        if (!isPaused) {
          await recording?.pauseAsync();
          setIsPaused(true);
        } else {
          await recording?.startAsync();
          setIsPaused(false);
        }
      }
    } catch (err) {
      console.error("Recording control failure", err);
    }
  }

  // Finish Recording with Dynamic Indexing System
  async function finishRecording() {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      const status = await recording.getStatusAsync();

      if (uri && status.durationMillis) {
        // Automatically determine next numerical index based on existing entries
        const nextIndex = recordings.length + 1;
        const compoundName = `Rec#${nextIndex}_${getFormattedDateTime()}`;

        const newRecording: RecordingItem = {
          id: Date.now().toString(),
          uri: uri,
          name: compoundName,
          duration: formatDuration(status.durationMillis),
        };

        const updatedList = [newRecording, ...recordings];
        setRecordings(updatedList);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      }
    } catch (error) {
      console.error("Failed to finish recording", error);
    } finally {
      setRecording(null);
      setIsRecording(false);
      setIsPaused(false);
    }
  }

  async function playRecording(item: RecordingItem) {
    try {
      if (sound) {
        await sound.unloadAsync();
        if (playingId === item.id) {
          setPlayingId(null);
          setSound(null);
          return;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: item.uri },
        { shouldPlay: true },
      );

      setSound(newSound);
      setPlayingId(item.id);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
          setSound(null);
        }
      });
    } catch (error) {
      console.error("Playback error", error);
    }
  }

  const updateFileName = async (id: string, newName: string) => {
    const updatedList = recordings.map((item) =>
      item.id === id ? { ...item, name: newName } : item,
    );
    setRecordings(updatedList);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  };

  async function deleteRecording(item: RecordingItem) {
    Alert.alert(
      "Delete Recording",
      `Are you sure you want to delete "${item.name}" permanently?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (playingId === item.id && sound) {
                await sound.unloadAsync();
                setPlayingId(null);
                setSound(null);
              }

              const fileInfo = await FileSystem.getInfoAsync(item.uri);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(item.uri);
              }

              const updatedList = recordings.filter((r) => r.id !== item.id);
              setRecordings(updatedList);
              await AsyncStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(updatedList),
              );
            } catch (error) {
              console.error("Failed to delete file", error);
            }
          },
        },
      ],
    );
  }

  async function shareRecording(item: RecordingItem) {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("Error", "Sharing is not available on this device");
      return;
    }

    let tempUri: string | null = null;
    try {
      const sourceInfo = await FileSystem.getInfoAsync(item.uri);
      if (!sourceInfo.exists) {
        Alert.alert("Share Failed", "Recording file was not found.");
        return;
      }

      const baseFileName = item.uri.split("/").pop() || "recording.m4a";
      const fileExtension = baseFileName.includes(".")
        ? baseFileName.split(".").pop()
        : "m4a";
      const cleanFileName = item.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      tempUri = `${FileSystem.cacheDirectory}${cleanFileName}_${Date.now()}.${fileExtension}`;

      await FileSystem.copyAsync({ from: item.uri, to: tempUri });

      await Sharing.shareAsync(tempUri, {
        mimeType: "audio/x-m4a",
        dialogTitle: `Share "${item.name}"`,
      });
    } catch (error) {
      console.error("Sharing Error", error);
    } finally {
      if (tempUri) {
        const tempInfo = await FileSystem.getInfoAsync(tempUri);
        if (tempInfo.exists) {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        }
      }
    }
  }

  // Smart Search Filter: Matches against custom/edited names AND text patterns within timestamps
  const filteredRecordings = recordings.filter((rec) =>
    rec.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderRecordingItem = ({ item }: { item: RecordingItem }) => {
    const isCurrentPlaying = playingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardMain}>
          <TextInput
            style={styles.fileNameInput}
            value={item.name}
            onChangeText={(text) => updateFileName(item.id, text)}
            placeholder="Rename recording"
            placeholderTextColor="#888"
          />
          <Text style={styles.durationText}>{item.duration}</Text>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.btnDelete]}
            onPress={() => deleteRecording(item)}
          >
            <Text style={styles.actionButtonText}>🗑 Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              isCurrentPlaying ? styles.btnPause : styles.btnPlay,
            ]}
            onPress={() => playRecording(item)}
          >
            <Text style={styles.actionButtonText}>
              {isCurrentPlaying ? "✕ Stop" : "▶ Play"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.btnShare]}
            onPress={() => shareRecording(item)}
          >
            <Text style={styles.actionButtonText}>🔗 Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.headerTitle}>Voice Recorder</Text>

      {/* Dual Search Input Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchBar}
          placeholder="🔎 Search by name or date (e.g. 2026-05)..."
          placeholderTextColor="#A0A5AA"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredRecordings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery
              ? "No matching recordings found."
              : "No recordings yet. Tap below to start!"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRecordings}
          renderItem={renderRecordingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Control Footer */}
      <View style={styles.footer}>
        {isRecording && (
          <View style={styles.waveContainer}>
            <Animated.View
              style={[
                styles.waveBar,
                { transform: [{ scaleY: waveAnim1 }] },
                isPaused && styles.wavePaused,
              ]}
            />
            <Animated.View
              style={[
                styles.waveBar,
                styles.waveBarLong,
                { transform: [{ scaleY: waveAnim2 }] },
                isPaused && styles.wavePaused,
              ]}
            />
            <Animated.View
              style={[
                styles.waveBar,
                { transform: [{ scaleY: waveAnim3 }] },
                isPaused && styles.wavePaused,
              ]}
            />
            <Animated.View
              style={[
                styles.waveBar,
                styles.waveBarLong,
                { transform: [{ scaleY: waveAnim1 }] },
                isPaused && styles.wavePaused,
              ]}
            />
            <Animated.View
              style={[
                styles.waveBar,
                { transform: [{ scaleY: waveAnim2 }] },
                isPaused && styles.wavePaused,
              ]}
            />
          </View>
        )}

        <View style={styles.recordingRow}>
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordingActive]}
            onPress={handleRecordPress}
            activeOpacity={0.8}
          >
            {isRecording ? (
              isPaused ? (
                <Text style={styles.controlIconText}>▶</Text>
              ) : (
                <View style={styles.pauseIconContainer}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              )
            ) : (
              <View style={styles.innerRecordCircle} />
            )}
          </TouchableOpacity>

          {isRecording && (
            <TouchableOpacity
              style={styles.finishButton}
              onPress={finishRecording}
              activeOpacity={0.8}
            >
              <Text style={styles.finishButtonText}>✓ Finish</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.statusText}>
          {!isRecording
            ? "Tap to start recording"
            : isPaused
              ? "Recording paused. Tap to resume or click Finish"
              : "Recording audio... Tap button to pause"}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1A1D20",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    backgroundColor: "#EEEEEE",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    fontSize: 15,
    color: "#212529",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 200,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 140,
  },
  emptyText: {
    color: "#6C757D",
    fontSize: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F5",
    paddingBottom: 12,
    marginBottom: 12,
  },
  fileNameInput: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    flex: 1,
    marginRight: 10,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "500",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  btnPlay: {
    backgroundColor: "#007AFF",
  },
  btnPause: {
    backgroundColor: "#FF9500",
  },
  btnShare: {
    backgroundColor: "#0e6f26",
  },
  btnDelete: {
    backgroundColor: "#E53E3E",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingTop: 12,
    paddingBottom: 32,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E9ECEF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 10,
  },
  waveContainer: {
    flexDirection: "row",
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 6,
  },
  waveBar: {
    width: 4,
    height: 10,
    backgroundColor: "#FF3B30",
    borderRadius: 2,
  },
  waveBarLong: {
    height: 14,
  },
  wavePaused: {
    backgroundColor: "#A0A5AA",
  },
  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    position: "relative",
    marginBottom: 8,
  },
  recordButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: "#E9ECEF",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingActive: {
    borderColor: "#FF3B30",
  },
  innerRecordCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FF3B30",
  },
  controlIconText: {
    fontSize: 26,
    color: "#FF3B30",
    textAlign: "center",
  },
  pauseIconContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  pauseBar: {
    width: 6,
    height: 24,
    backgroundColor: "#FF3B30",
    borderRadius: 2,
  },
  finishButton: {
    position: "absolute",
    right: "15%",
    backgroundColor: "#34C759",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  finishButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  statusText: {
    fontSize: 13,
    color: "#6C757D",
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
  },
});

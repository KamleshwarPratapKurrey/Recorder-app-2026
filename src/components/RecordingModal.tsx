import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, Alert } from 'react-native';
import { useAudioRecorder, AudioModule } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function RecordingModal({ visible, onClose }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const recorder = useAudioRecorder({ extension: '.m4a', sampleRate: 44100, numberOfChannels: 1, bitRate: 128000 });
  
  // Waveform heights shared state tracking values
  const wave1 = useSharedValue(15);
  const wave2 = useSharedValue(25);
  const wave3 = useSharedValue(10);
  const wave4 = useSharedValue(30);

  useEffect(() => {
    if (isRecording) {
      // Loop wave simulations smoothly to mimic microphone activity amplitude
      const startWaveAnim = (sv: any, target: number) => {
        sv.value = withRepeat(withSequence(withTiming(target, { duration: 350 }), withTiming(15, { duration: 350 })), -1, true);
      };
      startWaveAnim(wave1, 65); startWaveAnim(wave2, 85); startWaveAnim(wave3, 50); startWaveAnim(wave4, 90);
    } else {
      wave1.value = withTiming(15); wave2.value = withTiming(15); wave3.value = withTiming(15); wave4.value = withTiming(15);
    }
  }, [isRecording]);

  async function toggleRecordingEngine() {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Microphone Access Denied', 'Please grant system settings privileges.');
        return;
      }

      if (!isRecording) {
        await recorder.record();
        setIsRecording(true);
      } else {
        await recorder.stop();
        setIsRecording(false);
        
        const cachedUri = recorder.uri;
        if (cachedUri) {
          const rawStamp = new Date().toISOString().replace(/[:.]/g, '-');
          const finalFilename = `VoiceMemo_${rawStamp}.m4a`;
          const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
          
          await FileSystem.moveAsync({ from: cachedUri, to: `${baseDir}${finalFilename}` });
          // Safe completion notification inside immediate UI closing lifecycle
          onClose();
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Processing Error', 'Could not process audio buffers locally.');
    }
  }

  // Animated wave heights mappings 
  const animStyle1 = useAnimatedStyle(() => ({ height: wave1.value }));
  const animStyle2 = useAnimatedStyle(() => ({ height: wave2.value }));
  const animStyle3 = useAnimatedStyle(() => ({ height: wave3.value }));
  const animStyle4 = useAnimatedStyle(() => ({ height: wave4.value }));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.modalWorkspace}>
        
        <TouchableOpacity style={styles.topDismissHeader} onPress={onClose}>
          <Text style={styles.dismissText}>✕ Close Studio</Text>
        </TouchableOpacity>

        <Text style={styles.statusLabel}>{isRecording ? 'LIVE RECORDING STAGE' : 'STUDIO READY'}</Text>
        
        {/* Professional Digital Oscilloscope Audio Waves Canvas Container */}
        <View style={styles.waveVisualizerContainer}>
          <Animated.View style={[styles.waveBar, animStyle1]} />
          <Animated.View style={[styles.waveBar, animStyle2]} />
          <Animated.View style={[styles.waveBar, animStyle3]} />
          <Animated.View style={[styles.waveBar, animStyle4]} />
          <Animated.View style={[styles.waveBar, animStyle2]} />
          <Animated.View style={[styles.waveBar, animStyle1]} />
        </View>

        <View style={styles.actionDock}>
          <TouchableOpacity 
            style={[styles.masterRecordTrigger, isRecording ? styles.activeStopMode : styles.activeRecordMode]} 
            onPress={toggleRecordingEngine}
          >
            <Text style={styles.triggerText}>{isRecording ? "STOP" : "RECORD"}</Text>
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWorkspace: { flex: 1, backgroundColor: '#09090E', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 80 },
  topDismissHeader: { alignSelf: 'flex-start', marginLeft: 24, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#1C1C2E', borderRadius: 20 },
  dismissText: { color: '#8E8EAF', fontSize: 14, fontWeight: '600' },
  statusLabel: { color: '#00FFCC', fontSize: 14, letterSpacing: 2, fontWeight: '700', marginTop: 40 },
  
  waveVisualizerContainer: { flexDirection: 'row', height: 160, alignItems: 'center', justifyContent: 'center', width: '100%', gap: 10 },
  waveBar: { width: 10, minHeight: 15, borderRadius: 5, backgroundColor: '#00FFCC' },
  
  actionDock: { width: '100%', alignItems: 'center' },
  masterRecordTrigger: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 8 },
  activeRecordMode: { backgroundColor: '#FF3366', shadowColor: '#FF3366' },
  activeStopMode: { backgroundColor: '#FFF', shadowColor: '#FFF' },
  triggerText: { fontSize: 13, fontWeight: '900', color: '#09090E', letterSpacing: 1 }
});

// Pinch-to-zoom for feed photos with PERSISTENT zoom: the zoom level stays
// where the fingers leave it (cofounder decision 2026-10-04 — no Instagram
// spring-back). Pinching out below 1x snaps back to fit; double-tap toggles
// between fit and 2.5x at the tap point. Two-finger pinch-drag repositions
// while zoomed (the focal point tracks the fingers); one-finger gestures are
// never claimed, so feed scrolling and carousel paging work unchanged. The
// zoom clips to the photo's own frame via the parent's overflow:hidden.
import { Image, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SPRING = { damping: 22, stiffness: 240 };

export function ZoomableImage({ uri, width }: { uri: string; width: number }) {
  // Live transform (what renders) and the committed state it returns to /
  // builds on between gestures.
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  // Focal point at pinch start — the anchor the zoom happens around.
  const f0x = useSharedValue(0);
  const f0y = useSharedValue(0);

  // Keep the photo covering its frame: at scale s the center may shift at
  // most (s-1)·width/2 in either axis before an edge pulls inside.
  const clampT = (v: number, s: number): number => {
    'worklet';
    const max = (width * (s - 1)) / 2;
    return Math.min(Math.max(v, -max), max);
  };

  const reset = (): void => {
    'worklet';
    savedScale.value = 1;
    savedTx.value = 0;
    savedTy.value = 0;
    scale.value = withSpring(1, SPRING);
    tx.value = withSpring(0, SPRING);
    ty.value = withSpring(0, SPRING);
  };

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      f0x.value = e.focalX;
      f0y.value = e.focalY;
    })
    .onUpdate((e) => {
      const s = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_SCALE);
      const k = s / savedScale.value;
      scale.value = s;
      // Anchor the zoom at the start focal point on top of the committed
      // transform, then follow focal movement (two-finger pan).
      const half = width / 2;
      tx.value = clampT(
        (f0x.value - half) * (1 - k) + k * savedTx.value + (e.focalX - f0x.value),
        s,
      );
      ty.value = clampT(
        (f0y.value - half) * (1 - k) + k * savedTy.value + (e.focalY - f0y.value),
        s,
      );
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        reset();
      } else {
        // Commit — the zoom stays until the user pinches out or double-taps.
        savedScale.value = scale.value;
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (savedScale.value > 1) {
        reset();
      } else {
        const s = DOUBLE_TAP_SCALE;
        const half = width / 2;
        const targetX = clampT((e.x - half) * (1 - s), s);
        const targetY = clampT((e.y - half) * (1 - s), s);
        savedScale.value = s;
        savedTx.value = targetX;
        savedTy.value = targetY;
        scale.value = withSpring(s, SPRING);
        tx.value = withSpring(targetX, SPRING);
        ty.value = withSpring(targetY, SPRING);
      }
    });

  const gesture = Gesture.Race(pinch, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, aspectRatio: 1 }, animatedStyle]}>
        <Image source={{ uri }} style={styles.image} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
});

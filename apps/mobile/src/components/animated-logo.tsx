// Animated BluBranch mark for the splash overlay: the lower "b" draws first
// (ring sweep + stem climbing off it), then the upper "b" grows off the same
// stem, and finally the twig sprouts up-left. Geometry is a stroked-SVG
// recreation measured off assets/icon.png (rings r=91 centerline, stroke 70,
// vertical #B0C4DE→#4682B4 gradient) so the finished frame matches the static
// brand mark everywhere else in the app.
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Path lengths (px in the 1024 viewBox): circles 2π·91, lines measured.
const RING_LEN = 572;
const STEM_LEN = 245;
const THICK_STROKE = 74; // stem + twig measure 74px in icon.png; ring bands 70
const TWIG_LEN = 334;

// Stagger (ms): lower ring → stem → upper ring → twig.
const TIMING = {
  lowerRing: { delay: 100, duration: 600 },
  stem: { delay: 550, duration: 320 },
  upperRing: { delay: 820, duration: 600 },
  twig: { delay: 1350, duration: 380 },
};
export const LOGO_ANIMATION_MS = TIMING.twig.delay + TIMING.twig.duration; // 1730
const CROSSFADE_MS = 300;

// The stroked recreation matches the real mark to ~0.5% of pixels, but the
// real logo has rounded fillets at the junction corners that stroke unions
// can't produce. So once the draw-on completes, the actual icon.png
// cross-fades in over the strokes — the resting frame is the true asset,
// pixel-identical by definition. (icon.png is opaque white-on-white, which
// matches the splash background.)
const ICON = require('../../assets/icon.png');

export function AnimatedLogo({ size = 180 }: { size?: number }) {
  const lowerRing = useRef(new Animated.Value(RING_LEN)).current;
  const stem = useRef(new Animated.Value(STEM_LEN)).current;
  const upperRing = useRef(new Animated.Value(RING_LEN)).current;
  const twig = useRef(new Animated.Value(TWIG_LEN)).current;
  const finalMark = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const run = (v: Animated.Value, t: { delay: number; duration: number }) =>
      Animated.timing(v, {
        toValue: 0,
        duration: t.duration,
        delay: t.delay,
        easing: ease,
        // strokeDashoffset is an SVG prop — JS-driven animation required.
        useNativeDriver: false,
      });
    Animated.parallel([
      run(lowerRing, TIMING.lowerRing),
      run(stem, TIMING.stem),
      run(upperRing, TIMING.upperRing),
      run(twig, TIMING.twig),
    ]).start();
    Animated.timing(finalMark, {
      toValue: 1,
      duration: CROSSFADE_MS,
      delay: LOGO_ANIMATION_MS - 80, // start as the twig finishes landing
      useNativeDriver: true,
    }).start();
  }, [lowerRing, stem, upperRing, twig, finalMark]);

  // Both layers use the icon's full 1024 coordinate space (the mark is
  // centered in it), so the strokes and the bitmap align exactly.
  return (
    <View style={{ width: size, height: size }}>
      <AnimatedLogoStrokes size={size} values={{ lowerRing, stem, upperRing, twig }} />
      <Animated.Image
        source={ICON}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          opacity: finalMark,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

function AnimatedLogoStrokes({
  size,
  values,
}: {
  size: number;
  values: {
    lowerRing: Animated.Value;
    stem: Animated.Value;
    upperRing: Animated.Value;
    twig: Animated.Value;
  };
}) {
  const { lowerRing, stem, upperRing, twig } = values;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="markGradient" x1="0" y1="180" x2="0" y2="842" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#B0C4DE" />
          <Stop offset="1" stopColor="#4682B4" />
        </LinearGradient>
      </Defs>
      {/* lower b — ring sweeps from where the stem lands, then the stem climbs */}
      <AnimatedPath
        d="M 524 719 A 91 91 0 1 1 706 719 A 91 91 0 1 1 524 719"
        stroke="url(#markGradient)"
        strokeWidth={70}
        fill="none"
        strokeDasharray={`${RING_LEN} ${RING_LEN}`}
        strokeDashoffset={lowerRing}
      />
      {/* stem: square-ended; the top stops AT the visual junction (y=455) so
          it never pokes above the upper ring while that ring is still
          undrawn — the ring band overlaps it when it arrives, and the
          crossfade to icon.png owns the exact final join */}
      <AnimatedPath
        d="M 527 700 L 527 455"
        stroke="url(#markGradient)"
        strokeWidth={THICK_STROKE}
        strokeLinecap="butt"
        fill="none"
        strokeDasharray={`${STEM_LEN} ${STEM_LEN}`}
        strokeDashoffset={stem}
      />
      {/* upper b — grows off the stem it just climbed */}
      <AnimatedPath
        d="M 563 437 A 91 91 0 1 1 563 255 A 91 91 0 1 1 563 437"
        stroke="url(#markGradient)"
        strokeWidth={70}
        fill="none"
        strokeDasharray={`${RING_LEN} ${RING_LEN}`}
        strokeDashoffset={upperRing}
      />
      {/* twig sprouts up-left from the junction */}
      <AnimatedPath
        d="M 548 460 L 320 217"
        stroke="url(#markGradient)"
        strokeWidth={THICK_STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${TWIG_LEN} ${TWIG_LEN}`}
        strokeDashoffset={twig}
      />
    </Svg>
  );
}

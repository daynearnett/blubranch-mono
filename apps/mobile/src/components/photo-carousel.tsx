// Instagram-style paged photo carousel for feed posts. Horizontal paging
// FlatList: the native scroll view claims horizontal gestures before the
// tab pager does, so swiping photos never switches tabs. Single-photo posts
// render one zoomable image (no dots/counter). Every photo is pinch-to-zoom
// (ZoomableImage); the zoom clips to the photo frame via the wrappers'
// overflow:hidden, so it can't disturb paging or the feed list.
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme.js';
import { ZoomableImage } from './zoomable-image.js';

interface CarouselPhoto {
  photoUrl: string;
}

export function PhotoCarousel({ photos }: { photos: CarouselPhoto[] }) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  if (photos.length === 0) return null;
  if (photos.length === 1) {
    return (
      <View style={styles.singleWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? <ZoomableImage uri={photos[0]!.photoUrl} width={width} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <FlatList
            data={photos}
            keyExtractor={(p, i) => `${p.photoUrl}-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            renderItem={({ item }) => <ZoomableImage uri={item.photoUrl} width={width} />}
            onMomentumScrollEnd={(e) => {
              setPage(Math.round(e.nativeEvent.contentOffset.x / width));
            }}
          />
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {page + 1}/{photos.length}
            </Text>
          </View>
          <View style={styles.dots}>
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  singleWrap: {
    width: '100%',
    aspectRatio: 1, // matches the square crop the composer's editor produces
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    overflow: 'hidden', // clips the pinch zoom to the photo frame
  },
  wrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  counter: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(15,45,82,0.65)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  counterText: { ...typography.caption, color: colors.textInverse, fontWeight: '600' },
  dots: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dotActive: { backgroundColor: colors.textInverse },
});

import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo, build_osm


class GeoTest(unittest.TestCase):
    def test_origin(self):
        self.assertEqual(geo.to_xy(39.7145, 21.6265), (0.0, 0.0))

    def test_great_meteoron(self):
        x, y = geo.to_xy(39.7275, 21.6248)
        self.assertAlmostEqual(x, -145.4, delta=0.5); self.assertAlmostEqual(y, 1445.5, delta=0.5)

    def test_corner_inside_block(self):
        x, y = geo.to_xy(39.731, 21.648)
        self.assertTrue(1838 < x <= 1840 and 1833 < y <= 1836)

    def test_new_corner_inside_block(self):  # SE corner of the extension strips
        x, y = geo.to_xy(39.6966, 21.6546)
        self.assertTrue(x >= geo.X1 and y <= geo.Y0)
        self.assertEqual((geo.NX, geo.NY), (531, 478))
        self.assertEqual((geo.X0 + (geo.NX - 1) * geo.STEP, geo.Y0 + (geo.NY - 1) * geo.STEP), (geo.X1, geo.Y1))

    def test_clip_ring_straddling_east_edge(self):
        r = geo.clip_ring([(2350, 0), (2450, 0), (2450, 50), (2350, 50)])
        self.assertEqual(sorted(r), [(2350, 0), (2350, 50), (2400, 0), (2400, 50)])

    def test_clip_ring_straddling_west_and_south_edges(self):
        r = geo.clip_ring([(-1900, -2000), (-1800, -2000), (-1800, -1900), (-1900, -1900)])
        self.assertEqual(sorted(r), [(-1840, -1980), (-1840, -1900), (-1800, -1980), (-1800, -1900)])

    def test_clip_ring_outside(self):
        self.assertEqual(geo.clip_ring([(2500, 0), (2600, 0), (2600, 50)]), [])

    def test_clip_line_south_edge(self):
        self.assertEqual(geo.clip_line([(0, -2100), (0, 0)]), [[(0.0, -1980.0), (0, 0)]])

    def test_clip_line_splits(self):
        self.assertEqual(len(geo.clip_line([(-1900, 0), (0, 0), (0, 1900), (0, 0)])), 2)

    def test_degenerate_ring_dropped(self):
        self.assertEqual(geo.clip_ring([(0, 0), (0, 0), (5, 5)]), [])


class OsmMappingTest(unittest.TestCase):
    def test_cover_kinds(self):
        k = build_osm.cover_kind
        self.assertEqual(k({"amenity": "school"}), "school")
        self.assertEqual(k({"amenity": "kindergarten"}), "school")
        self.assertEqual(k({"place": "square"}), "square")
        self.assertEqual(k({"highway": "pedestrian", "area": "yes"}), "square")
        self.assertEqual(k({"amenity": "parking"}), "parking")
        self.assertEqual(k({"leisure": "pitch", "sport": "basketball"}), "pitch")
        self.assertEqual(k({"leisure": "park"}), "park")
        self.assertEqual(k({"leisure": "garden"}), "garden")
        self.assertEqual(k({"landuse": "cemetery"}), "cemetery")
        self.assertEqual(k({"leisure": "swimming_pool"}), "pool")
        self.assertEqual(k({"landuse": "grass"}), "grass")          # unchanged
        self.assertEqual(k({"natural": "wood"}), "wood")            # unchanged
        self.assertIsNone(k({"building": "yes"}))

    def test_road_surface(self):
        s = build_osm.road_surface
        self.assertEqual(s({"surface": "paving_stones"}), "pavers")
        self.assertEqual(s({"surface": "sett"}), "pavers")
        self.assertEqual(s({"surface": "dirt"}), "unpaved")
        self.assertIsNone(s({"surface": "asphalt"}))
        self.assertIsNone(s({}))


if __name__ == "__main__":
    unittest.main()

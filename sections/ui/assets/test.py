import math

import FreeCAD as App
import Part
from FreeCAD import Vector


def create_parametric_usv(params=None):
    """Create a parametric catamaran USV concept model in FreeCAD.

    Unit: millimetre.  The origin is near the stern, X points to the bow,
    Y is transverse, and Z points upward.
    """
    p = {
        "doc_name": "Advanced_Manufacturing_Parametric_USV",
        "total_length": 6000,
        "hull_spacing": 1800,
        "hull_radius": 350,
        "hull_mid_length": 4000,
        "hull_bow_length": 1000,
        "hull_stern_length": 1000,
        "deck_length": 4500,
        "deck_width_margin": 400,
        "deck_height": 150,
        "deck_z": 330,
        "deck_top_z": 480,
        "cabin_length": 2200,
        "cabin_width": 1200,
        "cabin_height": 500,
        "cabin_center_x": 3000,
        "mast_x": 4500,
        "mast_top_z": 2000,
        "rtk_x": 2200,
    }
    if params:
        p.update(params)

    try:
        App.closeDocument(p["doc_name"])
    except Exception:
        pass

    doc = App.newDocument(p["doc_name"])

    colors = {
        "hull": (0.15, 0.15, 0.17),
        "hull_light": (0.24, 0.24, 0.27),
        "deck": (0.50, 0.50, 0.53),
        "deck_dark": (0.34, 0.34, 0.36),
        "white": (0.86, 0.86, 0.88),
        "green": (0.24, 0.34, 0.16),
        "yellow": (0.95, 0.62, 0.12),
        "orange": (1.00, 0.35, 0.00),
        "black": (0.05, 0.05, 0.07),
        "red": (0.90, 0.05, 0.03),
        "nav_green": (0.00, 0.65, 0.18),
        "metal": (0.72, 0.72, 0.74),
        "solar": (0.05, 0.10, 0.30),
        "solar_line": (0.62, 0.66, 0.72),
    }

    def add_obj(shape, name, color):
        obj = doc.addObject("Part::Feature", name)
        obj.Shape = shape
        obj.ViewObject.ShapeColor = color
        return obj

    def make_stealth_box(length, width, height, inset):
        bottom = [
            Vector(-length / 2, -width / 2, 0),
            Vector(length / 2, -width / 2, 0),
            Vector(length / 2, width / 2, 0),
            Vector(-length / 2, width / 2, 0),
            Vector(-length / 2, -width / 2, 0),
        ]
        top = [
            Vector(-length / 2 + inset, -width / 2 + inset, height),
            Vector(length / 2 - inset, -width / 2 + inset, height),
            Vector(length / 2 - inset, width / 2 - inset, height),
            Vector(-length / 2 + inset, width / 2 - inset, height),
            Vector(-length / 2 + inset, -width / 2 + inset, height),
        ]
        return Part.makeLoft(
            [Part.makePolygon(bottom), Part.makePolygon(top)],
            True,
        )

    def add_box(name, length, width, height, center_x, center_y, base_z, color):
        shape = Part.makeBox(length, width, height)
        shape.translate(Vector(center_x - length / 2, center_y - width / 2, base_z))
        return add_obj(shape, name, color)

    def add_cylinder_z(name, radius, height, center_x, center_y, base_z, color):
        shape = Part.makeCylinder(
            radius,
            height,
            Vector(center_x, center_y, base_z),
            Vector(0, 0, 1),
        )
        return add_obj(shape, name, color)

    def add_sphere(name, radius, center_x, center_y, center_z, color):
        shape = Part.makeSphere(radius)
        shape.translate(Vector(center_x, center_y, center_z))
        return add_obj(shape, name, color)

    total_length = p["total_length"]
    spacing = p["hull_spacing"]
    radius = p["hull_radius"]
    deck_top_z = p["deck_top_z"]
    cabin_top_z = deck_top_z + p["cabin_height"]

    # Twin hulls: stern frustum, constant mid-body cylinder, and bow cone.
    for side in (1, -1):
        y = spacing / 2 * side
        stern = Part.makeCone(
            radius * 0.6,
            radius,
            p["hull_stern_length"],
            Vector(0, y, 0),
            Vector(1, 0, 0),
        )
        mid = Part.makeCylinder(
            radius,
            p["hull_mid_length"],
            Vector(p["hull_stern_length"], y, 0),
            Vector(1, 0, 0),
        )
        bow = Part.makeCone(
            radius,
            0,
            p["hull_bow_length"],
            Vector(total_length - p["hull_bow_length"], y, 0),
            Vector(1, 0, 0),
        )
        add_obj(stern.fuse(mid).fuse(bow), f"Hull_{side:+d}", colors["hull"])

        # Visible chines/keel pads make the hull read as an engineered assembly.
        add_box(
            f"Hull_Top_Flat_{side:+d}",
            3600,
            420,
            34,
            3000,
            y,
            radius * 0.72,
            colors["hull_light"],
        )
        add_box(
            f"Hull_Outer_Rub_Rail_{side:+d}",
            4200,
            70,
            80,
            2850,
            y + side * (radius - 40),
            45,
            colors["black"],
        )
        add_box(
            f"Hull_Inner_Rub_Rail_{side:+d}",
            3900,
            55,
            60,
            3000,
            y - side * (radius - 60),
            70,
            colors["hull_light"],
        )
        add_box(
            f"Transom_Block_{side:+d}",
            260,
            520,
            360,
            120,
            y,
            -160,
            colors["hull_light"],
        )

    deck = make_stealth_box(
        p["deck_length"],
        spacing + p["deck_width_margin"],
        p["deck_height"],
        100,
    )
    deck.translate(Vector(total_length / 2, 0, p["deck_z"]))
    add_obj(deck, "Main_Deck", colors["deck"])

    deck_width = spacing + p["deck_width_margin"]
    deck_center_x = total_length / 2
    deck_base_z = p["deck_z"]
    deck_top = deck_base_z + p["deck_height"]

    add_box("Deck_Front_Lip", 120, deck_width + 80, 90, deck_center_x + p["deck_length"] / 2 - 60, 0, deck_top, colors["deck_dark"])
    add_box("Deck_Rear_Lip", 120, deck_width + 80, 90, deck_center_x - p["deck_length"] / 2 + 60, 0, deck_top, colors["deck_dark"])
    add_box("Deck_Port_Lip", p["deck_length"], 90, 90, deck_center_x, deck_width / 2, deck_top, colors["deck_dark"])
    add_box("Deck_Starboard_Lip", p["deck_length"], 90, 90, deck_center_x, -deck_width / 2, deck_top, colors["deck_dark"])

    for x in (1500, 3000, 4500):
        add_box(f"Cross_Beam_{x}", 220, deck_width + 260, 120, x, 0, 180, colors["deck_dark"])

    for x in (1100, 4900):
        for side in (1, -1):
            add_cylinder_z(
                f"Deck_Mooring_Post_{x}_{side:+d}",
                45,
                140,
                x,
                side * 820,
                deck_top,
                colors["metal"],
            )

    cabin = make_stealth_box(
        p["cabin_length"],
        p["cabin_width"],
        p["cabin_height"],
        150,
    )
    cabin.translate(Vector(p["cabin_center_x"], 0, deck_top_z))
    add_obj(cabin, "Equipment_Cabin", colors["white"])

    add_box("Cabin_Base_Gasket", p["cabin_length"] + 120, p["cabin_width"] + 120, 45, p["cabin_center_x"], 0, deck_top_z - 20, colors["black"])
    add_box("Cabin_Front_Window", 520, 28, 180, p["cabin_center_x"] + 780, -p["cabin_width"] / 2 - 4, deck_top_z + 230, colors["solar"])
    add_box("Cabin_Port_Window", 680, 28, 140, p["cabin_center_x"] - 120, p["cabin_width"] / 2 + 4, deck_top_z + 260, colors["solar"])
    add_box("Cabin_Starboard_Window", 680, 28, 140, p["cabin_center_x"] - 120, -p["cabin_width"] / 2 - 4, deck_top_z + 260, colors["solar"])

    solar = Part.makeBox(1500, 800, 10)
    solar.translate(Vector(p["cabin_center_x"] - 750, -400, cabin_top_z))
    add_obj(solar, "Solar_Panel", colors["solar"])

    for offset in (-500, -250, 0, 250, 500):
        add_box(
            f"Solar_Cell_Divider_X_{offset:+d}",
            12,
            820,
            12,
            p["cabin_center_x"] + offset,
            0,
            cabin_top_z + 10,
            colors["solar_line"],
        )
    for offset in (-200, 0, 200):
        add_box(
            f"Solar_Cell_Divider_Y_{offset:+d}",
            1520,
            10,
            12,
            p["cabin_center_x"],
            offset,
            cabin_top_z + 12,
            colors["solar_line"],
        )

    add_box("Battery_Bay_LiFePO4_A", 820, 260, 220, 1900, 450, deck_top, colors["green"])
    add_box("Battery_Bay_LiFePO4_B", 820, 260, 220, 1900, 150, deck_top, colors["green"])
    add_box("Equipment_Bay", 620, 420, 260, 2050, -440, deck_top, colors["yellow"])
    for y in (150, 450):
        for offset in (-250, 0, 250):
            add_box(f"Battery_Rib_{y}_{offset:+d}", 35, 280, 235, 1900 + offset, y, deck_top + 5, colors["hull_light"])

    mast = Part.makeCylinder(
        40,
        spacing,
        Vector(p["mast_x"], -spacing / 2, p["mast_top_z"]),
        Vector(0, 1, 0),
    )
    add_obj(mast, "Mast_Crossbar", colors["hull"])

    for side in (1, -1):
        foot = Vector(p["mast_x"] - 300, (spacing / 2 - 100) * side, deck_top_z)
        top = Vector(p["mast_x"], (spacing / 2 - 100) * side, p["mast_top_z"])
        leg = Part.makeCylinder(40, (top - foot).Length, foot, top - foot)
        add_obj(leg, f"Mast_Leg_{side:+d}", colors["hull"])
        add_box(
            f"Mast_Foot_Plate_{side:+d}",
            260,
            180,
            30,
            p["mast_x"] - 300,
            (spacing / 2 - 100) * side,
            deck_top,
            colors["black"],
        )

    lidar = Part.makeCylinder(50, 100, Vector(p["mast_x"], 0, p["mast_top_z"] + 40), Vector(0, 0, 1))
    add_obj(lidar, "LiDAR", colors["white"])
    add_cylinder_z("LiDAR_Black_Base", 70, 45, p["mast_x"], 0, p["mast_top_z"] + 5, colors["black"])

    ptz_base = Part.makeBox(100, 100, 50)
    ptz_base.translate(Vector(p["mast_x"] - 50, -50, p["mast_top_z"] - 90))
    ptz_ball = Part.makeSphere(70)
    ptz_ball.translate(Vector(p["mast_x"], 0, p["mast_top_z"] - 150))
    add_obj(ptz_base.fuse(ptz_ball), "PTZ_Camera", colors["white"])

    for side in (1, -1):
        add_cylinder_z(
            f"GNSS_Antenna_{side:+d}",
            22,
            170,
            p["cabin_center_x"] + 820,
            side * 430,
            cabin_top_z,
            colors["metal"],
        )
        add_cylinder_z(
            f"GNSS_Antenna_Cap_{side:+d}",
            48,
            26,
            p["cabin_center_x"] + 820,
            side * 430,
            cabin_top_z + 170,
            colors["white"],
        )

    radar_base = Part.makeCylinder(
        40,
        200,
        Vector(p["cabin_center_x"] + 500, 0, cabin_top_z),
        Vector(0, 0, 1),
    )
    radar_bar = Part.makeBox(100, 1000, 40)
    radar_bar.translate(Vector(p["cabin_center_x"] + 450, -500, cabin_top_z + 200))
    add_obj(radar_base.fuse(radar_bar), "Navigation_Radar", colors["white"])

    add_cylinder_z("Radar_Dome_Mast", 35, 640, p["cabin_center_x"] + 250, 360, cabin_top_z, colors["metal"])
    add_sphere("Radar_Dome", 190, p["cabin_center_x"] + 250, 360, cabin_top_z + 760, colors["white"])

    for side in (1, -1):
        y = 450 * side
        pole = Part.makeCylinder(15, 500, Vector(p["rtk_x"], y, cabin_top_z), Vector(0, 0, 1))
        head = Part.makeCylinder(60, 30, Vector(p["rtk_x"], y, cabin_top_z + 500), Vector(0, 0, 1))
        add_obj(pole.fuse(head), f"RTK_Antenna_{side:+d}", colors["white"])
        add_cylinder_z(f"RTK_Base_{side:+d}", 45, 45, p["rtk_x"], y, cabin_top_z - 5, colors["black"])

    sat_base = Part.makeCylinder(180, 100, Vector(p["cabin_center_x"] - 600, 0, cabin_top_z), Vector(0, 0, 1))
    sat_dome = Part.makeSphere(180)
    sat_dome.translate(Vector(p["cabin_center_x"] - 600, 0, cabin_top_z + 100))
    add_obj(sat_base.fuse(sat_dome), "SatCom_Dome", colors["white"])

    add_cylinder_z("Port_Navigation_Light_Red", 28, 34, 5150, spacing / 2 - 110, deck_top + 10, colors["red"])
    add_cylinder_z("Starboard_Navigation_Light_Green", 28, 34, 5150, -spacing / 2 + 110, deck_top + 10, colors["nav_green"])
    add_sphere("Stern_Status_Light", 40, 850, 0, deck_top + 70, colors["orange"])
    add_cylinder_z("Emergency_Stop_Button", 55, 45, 2600, -760, cabin_top_z + 10, colors["red"])

    for side in (1, -1):
        jet = Part.makeCylinder(135, 380, Vector(60, spacing / 2 * side, -60), Vector(1, 0, 0))
        nozzle = Part.makeCone(135, 70, 220, Vector(-160, spacing / 2 * side, -60), Vector(1, 0, 0))
        add_obj(jet.fuse(nozzle), f"WaterJet_{side:+d}", colors["black"])
        add_box(f"Thruster_Mount_{side:+d}", 320, 300, 210, 190, spacing / 2 * side, -160, colors["hull_light"])

    sonar_pole = Part.makeCylinder(24, 500, Vector(p["mast_x"], 0, -80), Vector(0, 0, 1))
    sonar_head = Part.makeBox(400, 250, 120)
    sonar_head.translate(Vector(p["mast_x"] - 200, -125, -80))
    add_obj(sonar_pole.fuse(sonar_head), "Sonar_System", colors["orange"])

    doc.recompute()

    try:
        import FreeCADGui

        FreeCADGui.ActiveDocument.ActiveView.viewAxometric()
        FreeCADGui.ActiveDocument.ActiveView.fitAll()
    except Exception:
        pass

    return doc


if __name__ == "__main__":
    create_parametric_usv()

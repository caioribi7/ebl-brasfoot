import struct
import os

def read_utf(data, pos):
    if pos >= len(data) or data[pos] != 0x74:
        return None, pos
    length = struct.unpack('>H', data[pos+1:pos+3])[0]
    if length == 0 or pos + 3 + length > len(data):
        return None, pos
    s = data[pos+3:pos+3+length].decode('utf-8', errors='replace')
    return s, pos + 3 + length

def read_int(data, pos):
    if pos + 4 > len(data):
        return 0, pos
    return struct.unpack('>I', data[pos:pos+4])[0], pos + 4

def read_bool(data, pos):
    if pos >= len(data):
        return False, pos
    return data[pos] != 0, pos + 1

def parse_ban_file(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()

    # Find first xp (end of team class descriptor)
    xp1 = data.find(b'\x78\x70')
    if xp1 == -1:
        return None

    # Team data starts after first xp
    pos = xp1 + 2

    # Team fields: a(I), aid(I), b(I), c(I), g(I), i(I), id(I), mark(Z), n(I), o(I), sid(I), tid(I), valid(Z), vid(I)
    team_a, pos = read_int(data, pos)
    team_aid, pos = read_int(data, pos)
    team_b, pos = read_int(data, pos)
    team_c, pos = read_int(data, pos)
    team_g, pos = read_int(data, pos)
    team_i, pos = read_int(data, pos)
    team_id, pos = read_int(data, pos)
    team_mark, pos = read_bool(data, pos)
    team_n, pos = read_int(data, pos)
    team_o, pos = read_int(data, pos)
    team_sid, pos = read_int(data, pos)
    team_tid, pos = read_int(data, pos)
    team_valid, pos = read_bool(data, pos)
    team_vid, pos = read_int(data, pos)

    # Strings: cor1, cor2, short_name, name, stadium, coach
    cor1, pos = read_utf(data, pos)
    cor2, pos = read_utf(data, pos)
    short_name, pos = read_utf(data, pos)
    name, pos = read_utf(data, pos)
    stadium, pos = read_utf(data, pos)
    coach, pos = read_utf(data, pos)

    if not name:
        return None

    # Find ArrayList size
    arr_pos = data.find(b'\x77\x04', pos)
    if arr_pos == -1:
        return None

    player_count, _ = read_int(data, arr_pos + 2)

    # Find player class xp (second xp in file)
    xp2 = data.find(b'\x78\x70', xp1 + 1)
    if xp2 == -1:
        return None

    # Player data starts after player class xp
    player_pos = xp2 + 2

    # Player fields: aid(I), b(Z), c(I), d(I), e(I), f(I), g(I), h(I), hash(I), i(Z), j(I), sid(I), tid(I), a(String)
    players = []
    position_map = {0: 'GK', 1: 'DEF', 2: 'MID', 3: 'MID', 4: 'FWD'}

    for _ in range(player_count):
        if data[player_pos:player_pos+2] == b'\x73\x71':
            player_pos += 6
        elif data[player_pos:player_pos+2] == b'\x73\x72':
            xp_p = data.find(b'\x78\x70', player_pos)
            if xp_p == -1:
                break
            player_pos = xp_p + 2

        aid_val, player_pos = read_int(data, player_pos)
        b_bool, player_pos = read_bool(data, player_pos)
        c_val, player_pos = read_int(data, player_pos)
        d_val, player_pos = read_int(data, player_pos)
        e_val, player_pos = read_int(data, player_pos)
        f_val, player_pos = read_int(data, player_pos)
        g_val, player_pos = read_int(data, player_pos)
        h_val, player_pos = read_int(data, player_pos)
        hash_val, player_pos = read_int(data, player_pos)
        i_bool, player_pos = read_bool(data, player_pos)
        j_val, player_pos = read_int(data, player_pos)
        sid_val, player_pos = read_int(data, player_pos)
        tid_val, player_pos = read_int(data, player_pos)
        pname, player_pos = read_utf(data, player_pos)

        if pname is None:
            continue

        position = position_map.get(e_val, 'MID')

        # d = overall strength (typically 15-40 in ban files, scale to 50-99)
        overall = min(99, max(50, int(d_val * 2.2)))

        # Generate attributes based on position and overall
        base = overall
        if position == 'GK':
            pace = max(30, base - 20)
            shooting = max(20, base - 30)
            passing = max(40, base - 10)
            dribbling = max(30, base - 20)
            defending = max(50, base + 10)
            physical = max(55, base + 15)
            stamina = max(50, base)
        elif position == 'DEF':
            pace = max(40, base - 5)
            shooting = max(30, base - 20)
            passing = max(45, base - 5)
            dribbling = max(40, base - 10)
            defending = max(55, base + 15)
            physical = max(55, base + 10)
            stamina = max(50, base)
        elif position == 'MID':
            pace = max(45, base)
            shooting = max(45, base - 5)
            passing = max(55, base + 10)
            dribbling = max(50, base + 5)
            defending = max(40, base - 10)
            physical = max(45, base - 5)
            stamina = max(55, base + 5)
        else:  # FWD
            pace = max(50, base + 5)
            shooting = max(55, base + 10)
            passing = max(40, base - 5)
            dribbling = max(50, base + 5)
            defending = max(25, base - 25)
            physical = max(45, base - 5)
            stamina = max(50, base)

        players.append({
            'name': pname,
            'position': position,
            'overall': overall,
            'pace': pace,
            'shooting': shooting,
            'passing': passing,
            'dribbling': dribbling,
            'defending': defending,
            'physical': physical,
            'stamina': stamina,
            'is_starter': 1 if i_bool else 0,
            'is_captain': 1 if b_bool else 0,
        })

    # Calculate team strengths from players
    if players:
        gk_players = [p for p in players if p['position'] == 'GK']
        def_players = [p for p in players if p['position'] == 'DEF']
        mid_players = [p for p in players if p['position'] == 'MID']
        fwd_players = [p for p in players if p['position'] == 'FWD']

        attack_strength = min(99, max(30, int(sum(p['shooting'] for p in fwd_players) / max(1, len(fwd_players))))) if fwd_players else 50
        midfield_strength = min(99, max(30, int(sum(p['passing'] for p in mid_players) / max(1, len(mid_players))))) if mid_players else 50
        defense_strength = min(99, max(30, int(sum(p['defending'] for p in def_players) / max(1, len(def_players))))) if def_players else 50
        overall_strength = (attack_strength + midfield_strength + defense_strength) // 3
    else:
        attack_strength = midfield_strength = defense_strength = overall_strength = 50

    return {
        'name': name,
        'short_name': short_name or name[:3].upper(),
        'stadium': stadium,
        'coach': coach,
        'colors': {'primary': cor1, 'secondary': cor2},
        'attack_strength': attack_strength,
        'midfield_strength': midfield_strength,
        'defense_strength': defense_strength,
        'overall_strength': overall_strength,
        'players': players,
    }

def parse_all_ban_files(directory):
    teams = []
    if not os.path.exists(directory):
        return teams

    for filename in os.listdir(directory):
        if filename.endswith('.ban'):
            filepath = os.path.join(directory, filename)
            try:
                team = parse_ban_file(filepath)
                if team:
                    teams.append(team)
            except Exception as e:
                print(f"Erro ao parsear {filename}: {e}")

    return teams

if __name__ == '__main__':
    import json
    import sys

    directory = sys.argv[1] if len(sys.argv) > 1 else '/home/caio/Documentos/ebl-brasfoot/teams'
    teams = parse_all_ban_files(directory)

    print(f"Encontrados {len(teams)} times")
    for team in teams[:3]:
        print(f"\n{team['name']} (ATA:{team['attack_strength']} MEI:{team['midfield_strength']} DEF:{team['defense_strength']})")
        for p in team['players'][:5]:
            print(f"  {p['name']:25s} {p['position']:4s} OVE={p['overall']:3d}")

    with open('/tmp/teams-output.json', 'w') as f:
        json.dump(teams, f, indent=2, ensure_ascii=False)
    print(f"\nJSON salvo em /tmp/teams-output.json")

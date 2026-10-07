// What, if anything, needs the admin's attention on a station — one rule shared by the
// side-menu counter and the Stations page so they never disagree. The server enforces
// every seat rule; this only reads the fields GET /stations/ returns.

export type Station = {
    id: number;
    station_name: string;
    station_number: string | null;
    station_uuid: string;
    station_ip: string | null;
    station_port: number;
    is_online: boolean;
    mode?: "online" | "offline" | "hybrid";
    last_sync_at?: string | null;
    created_at: string;
    changed_at?: string | null;
    seat_state?: "active" | "pending" | "released";
    seat_changed_at?: string | null;
    seat_within_cap?: boolean;
    seat_list?: "listed" | "unlisted" | "no_list" | null;
    station_fingerprint?: string;
    conflict_fingerprint?: string;
    /** When the station last got the data set (push, USB file or its own pull). */
    data_pushed_at?: string | null;
};

/** Ordered from most to least urgent. */
export const PROBLEMS = ["conflict", "outside_cap", "unlisted", "pending", "offline"] as const;
export type StationProblem = (typeof PROBLEMS)[number];

export function stationProblem(station: Station): StationProblem | null {
    const seat = station.seat_state ?? "active";
    if (station.conflict_fingerprint) return "conflict";
    if (seat === "released") return null;
    if (seat === "pending") return "pending";
    if (station.seat_within_cap === false) return "outside_cap";
    if (station.seat_list === "unlisted" || station.seat_list === "no_list") return "unlisted";
    if (!station.is_online) return "offline";
    return null;
}

/** Stations the admin should look at (released ones are not in use, so never counted). */
export function attentionCount(stations: Station[]): number {
    return stations.filter((station) => stationProblem(station) !== null).length;
}

/** How new data (a print job) can reach a station now: over the network, only as a file for
 *  a USB stick (it is offline), or not at all — the server refuses stations without an
 *  active seat (pending, over the cap, not in the seat list) and a conflict needs a decision. */
export type Delivery = "network" | "file" | "blocked";

export function stationDelivery(station: Station): Delivery {
    const problem = stationProblem(station);
    if ((station.seat_state ?? "active") !== "active" || (problem !== null && problem !== "offline")) return "blocked";
    return problem === "offline" ? "file" : "network";
}

// Generated faces from thispersondoesnotexist.com in public/driver-photos, one for each driver in the bundled dataset.
// The drivers are fictional and the faces are of no real person. A face matches the first name, not anything else in the record.
import type { Actor } from "./present/types"

const IDS = new Set([
  "drv-002", "drv-00563", "drv-00564", "drv-015", "drv-016", "drv-021", "drv-025", "drv-026", "drv-027", "drv-028", "drv-030", "drv-032",
  "drv-033", "drv-034", "drv-037", "drv-042", "drv-050", "drv-052", "drv-055", "drv-059", "drv-060", "drv-063", "drv-064", "drv-068",
  "drv-098", "drv-105", "drv-110", "drv-112", "drv-119", "drv-120", "drv-121", "drv-128", "drv-130", "drv-136", "drv-139", "drv-140",
  "drv-165", "drv-169", "drv-175", "drv-178", "drv-182", "drv-184", "drv-188", "drv-195", "drv-216", "drv-224", "drv-231", "drv-232",
  "drv-238", "drv-243", "drv-249", "drv-250", "drv-252", "drv-253", "drv-257", "drv-260", "drv-262", "drv-265", "drv-270", "drv-271",
  "drv-272", "drv-273", "drv-275", "drv-277", "drv-278", "drv-279", "drv-282", "drv-287", "drv-288", "drv-291", "drv-293", "drv-294",
  "drv-295", "drv-297", "drv-299", "drv-301", "drv-306", "drv-307", "drv-308", "drv-310", "drv-311", "drv-312", "drv-313", "drv-315",
  "drv-317", "drv-318", "drv-319", "drv-320", "drv-322", "drv-326", "drv-329", "drv-331", "drv-334", "drv-336", "drv-337", "drv-343",
  "drv-346", "drv-347", "drv-348", "drv-349", "drv-350", "drv-353", "drv-355", "drv-356", "drv-357", "drv-360", "drv-362", "drv-363",
  "drv-364", "drv-365", "drv-366", "drv-367", "drv-369", "drv-371", "drv-377", "drv-378", "drv-385", "drv-431", "drv-434", "drv-443",
  "drv-444", "drv-445", "drv-448", "drv-449", "drv-450", "drv-451", "drv-453", "drv-454", "drv-455", "drv-457", "drv-458", "drv-460",
  "drv-463", "drv-464", "drv-466", "drv-467", "drv-468", "drv-469", "drv-472", "drv-473", "drv-474", "drv-476", "drv-477", "drv-478",
  "drv-479", "drv-481", "drv-482", "drv-483", "drv-484", "drv-485", "drv-486", "drv-487", "drv-489", "drv-492", "drv-493", "drv-495",
  "drv-496", "drv-497", "drv-499", "drv-500", "drv-510", "drv-520", "drv-552", "drv-566", "drv-567", "drv-569", "drv-570",
])

export function driverPhoto(driverId: string | null | undefined): string | null {
  return driverId && IDS.has(driverId) ? `/driver-photos/${driverId}.webp` : null
}

export function actorPhoto(actor: Actor | null | undefined): string | null {
  return actor?.kind === "driver" ? driverPhoto(actor.id) : null
}

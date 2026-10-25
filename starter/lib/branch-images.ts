// Example photos of car dealerships, used-car lots, yards and a storage hall from Wikimedia Commons.
// The sites in the dataset are fictional, so each photo is an example of that kind of place, not the site itself.
// Credits and licences are also in ASSET-SOURCES.md.

export type BranchImage = { src: string; kind: "dealership" | "source" | "yard" | "storage"; title: string; author: string; license: string; page: string }

export const BRANCH_IMAGES: BranchImage[] = [
  {"src": "/branch-images/dealership-1.jpg", "kind": "dealership", "title": "A.M.T. Autohaus Mittleres Taubertal - Tauberbischofsheim 01", "author": "Triplec85", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:A.M.T._Autohaus_Mittleres_Taubertal_-_Tauberbischofsheim_01.jpg"},
  {"src": "/branch-images/dealership-2.jpg", "kind": "dealership", "title": "Autohaus Heim Hechinger Straße 266 Tübingen 01", "author": "Giftzwerg 88", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Autohaus_Heim_Hechinger_Stra%C3%9Fe_266_T%C3%BCbingen_01.jpg"},
  {"src": "/branch-images/dealership-3.jpg", "kind": "dealership", "title": "Autohaus Heim Hechinger Straße 266 Tübingen 02", "author": "Giftzwerg 88", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Autohaus_Heim_Hechinger_Stra%C3%9Fe_266_T%C3%BCbingen_02.jpg"},
  {"src": "/branch-images/dealership-4.jpg", "kind": "dealership", "title": "Fürth Autohaus Pillenstein 001", "author": "Janericloebe", "license": "CC BY 3.0", "page": "https://commons.wikimedia.org/wiki/File:F%C3%BCrth_Autohaus_Pillenstein_001.JPG"},
  {"src": "/branch-images/dealership-5.jpg", "kind": "dealership", "title": "Saab Autohaus, Kiel", "author": "DYVER", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Saab_Autohaus,_Kiel.jpg"},
  {"src": "/branch-images/dealership-6.jpg", "kind": "dealership", "title": "Wilmersdorf Cicerostraße Autohaus Berolina-001", "author": "Fridolin freudenfett", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Wilmersdorf_Cicerostra%C3%9Fe_Autohaus_Berolina-001.jpg"},
  {"src": "/branch-images/dealership-7.jpg", "kind": "dealership", "title": "A Volvo car dealership in Chattanooga, Tennessee", "author": "Harrison Keely", "license": "CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:A_Volvo_car_dealership_in_Chattanooga,_Tennessee.jpg"},
  {"src": "/branch-images/dealership-8.jpg", "kind": "dealership", "title": "Car Dealership on Seafield Road - geograph.org.uk - 4007260", "author": "Graham Robson", "license": "CC BY-SA 2.0", "page": "https://commons.wikimedia.org/wiki/File:Car_Dealership_on_Seafield_Road_-_geograph.org.uk_-_4007260.jpg"},
  {"src": "/branch-images/dealership-9.jpg", "kind": "dealership", "title": "Car dealership 2025-01 1736086576", "author": "Artyom Svetlov", "license": "CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:Car_dealership_2025-01_1736086576.JPG"},
  {"src": "/branch-images/dealership-10.jpg", "kind": "dealership", "title": "Car dealership in Sandy Road - geograph.org.uk - 3543932", "author": "Richard Dorrell", "license": "CC BY-SA 2.0", "page": "https://commons.wikimedia.org/wiki/File:Car_dealership_in_Sandy_Road_-_geograph.org.uk_-_3543932.jpg"},
  {"src": "/branch-images/dealership-11.jpg", "kind": "dealership", "title": "Dunedin City Motors car dealership, 15 Jan 2026", "author": "Andykatib", "license": "CC0", "page": "https://commons.wikimedia.org/wiki/File:Dunedin_City_Motors_car_dealership,_15_Jan_2026.jpg"},
  {"src": "/branch-images/dealership-12.jpg", "kind": "dealership", "title": "Tonbridge Audi car dealership - geograph.org.uk - 2782634", "author": "Stacey Harris", "license": "CC BY-SA 2.0", "page": "https://commons.wikimedia.org/wiki/File:Tonbridge_Audi_car_dealership_-_geograph.org.uk_-_2782634.jpg"},
  {"src": "/branch-images/source-1.jpg", "kind": "source", "title": "Japanese Import Dealer (2424594968)", "author": "dave_7 from Lethbridge, Canada", "license": "CC BY-SA 2.0", "page": "https://commons.wikimedia.org/wiki/File:Japanese_Import_Dealer_(2424594968).jpg"},
  {"src": "/branch-images/source-2.jpg", "kind": "source", "title": "Japanese Import Dealer (2424594970)", "author": "dave_7 from Lethbridge, Canada", "license": "CC BY-SA 2.0", "page": "https://commons.wikimedia.org/wiki/File:Japanese_Import_Dealer_(2424594970).jpg"},
  {"src": "/branch-images/source-3.jpg", "kind": "source", "title": "Car dealership, Withleigh - geograph.org.uk - 5673727", "author": "Roger Cornfoot", "license": "CC BY-SA 2.0", "page": "https://commons.wikimedia.org/wiki/File:Car_dealership,_Withleigh_-_geograph.org.uk_-_5673727.jpg"},
  {"src": "/branch-images/yard-1.jpg", "kind": "yard", "title": "Automotive patterns - Flickr - 35mmMan", "author": "35mmMan", "license": "CC BY 2.0", "page": "https://commons.wikimedia.org/wiki/File:Automotive_patterns_-_Flickr_-_35mmMan.jpg"},
  {"src": "/branch-images/yard-2.jpg", "kind": "yard", "title": "Forth Street car park, Newcastle upon Tyne, 28 November 2011 (2)", "author": "Andrew Curtis", "license": "CC BY-SA 2.0", "page": "https://commons.wikimedia.org/wiki/File:Forth_Street_car_park,_Newcastle_upon_Tyne,_28_November_2011_(2).jpg"},
  {"src": "/branch-images/yard-3.jpg", "kind": "yard", "title": "Ports of Auckland Chase A Car", "author": "Ingolfson", "license": "Public domain", "page": "https://commons.wikimedia.org/wiki/File:Ports_of_Auckland_Chase_A_Car.jpg"},
  {"src": "/branch-images/storage-1.jpg", "kind": "storage", "title": "Concesionario de Mercedes-Benz, Múnich, Alemania, 2013-03-30, DD 25", "author": "Diego Delso", "license": "CC BY-SA 3.0", "page": "https://commons.wikimedia.org/wiki/File:Concesionario_de_Mercedes-Benz,_M%C3%BAnich,_Alemania,_2013-03-30,_DD_25.JPG"},
]

const KIND: Record<string, BranchImage["kind"]> = { DEALERSHIP: "dealership", SOURCE_DEALER: "source", TRANSFER_YARD: "yard", INDEPENDENT_STORAGE: "storage" }

/** A stable example photo for a site: the same site always gets the same photo of its kind. */
export function branchImage(siteId: string, siteKind: string): BranchImage {
  const pool = BRANCH_IMAGES.filter((image) => image.kind === (KIND[siteKind] ?? "dealership"))
  let hash = 0
  for (const char of siteId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return pool[hash % pool.length]
}

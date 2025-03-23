import { z } from "zod";
import axios from "axios";
import { defineDAINService, ToolConfig } from "@dainprotocol/service-sdk";
import { CardUIBuilder, MapUIBuilder, ImageCardUIBuilder } from "@dainprotocol/utils";

const geoapifyApiKey = '6ca0b6efffe246cda90e204dc02085e6';  // Geoapify API Key
interface PlaceProperties {
  name?: string;
  categories: string[];
  formatted?: string;
}

interface GeoapifyResponse {
  features: Array<{
    properties: PlaceProperties;
    geometry: {
      type: string;
      coordinates: [number, number];  // [longitude, latitude]
    };
  }>;
}
const getFunRec: ToolConfig = {
  id: "get-FunRec",
  name: "Get FunRec",
  description: "Fetches fun activities around the area",
  input: z
    .object({
      locationName: z.string().describe("Location name"),
      latitude: z.number().describe("Latitude coordinate"),
      longitude: z.number().describe("Longitude coordinate"),
    })
    .describe("Input parameters for the Fun Activities"),
  output: z
    .object({
      places: z.array(
        z.object({
          name: z.string().nullable().optional(),
          category: z.string(),
          address: z.string().default("No address available"),
        })
      ),
    })
    .describe("List of places with fun Activities"),
  pricing: { pricePerUse: 0, currency: "USD" },

  handler: async ({ locationName, latitude, longitude }, agentInfo, context) => {
    console.log(
      `User / Agent ${agentInfo.id} requested activities at ${locationName} (${latitude},${longitude})`
    );

    try {
      // Fetch places from Geoapify API
      const response = await axios.get<GeoapifyResponse>(
        `https://api.geoapify.com/v2/places?lat=${latitude}&lon=${longitude}&categories=tourism,leisure&limit=10&apiKey=${geoapifyApiKey}`
      );

      if (response.status !== 200) {
        throw new Error("Failed to fetch places from Geoapify");
      }
      
      const places = response.data.features;

      if (places.length === 0) {
        return {
          text: `No fun activities found near ${locationName}.`,
          data: {},
          ui: new CardUIBuilder()
            .setRenderMode("page")
            .title(`No Activities Found`)
          
            .content(`Sorry, we couldn't find any activities in ${locationName}. Try another location!`)
            .build(),
        };
      }

      const placeList = places
        .map((place) => {
          let name = place.properties.name;
          if (name === undefined) return null;  // Skip places without a name

          const placeLatitude = place.geometry.coordinates[1];
          const placeLongitude = place.geometry.coordinates[0];
          const address = place.properties.formatted || "No address available";

          return {
            name: name,
            category: place.properties.categories.join(", "),
            address: address,
            latitude: placeLatitude,
            longitude: placeLongitude,
          };
        })
        .filter((place) => place !== null); // Filter out null values

      const placesText = placeList
        .map((place, index) => `${index + 1}. ${place.name} - ${place.address}`)
        .join("\n");
return {
  text: `Here are some fun activities in ${locationName}:\n${placesText}`,
  data: {
    places: placeList,
  },
  ui: new CardUIBuilder()
    .setRenderMode("page")
    .title(`Fun Activities in ${locationName}`)
    .addChild(
      new MapUIBuilder()
        .setInitialView(latitude, longitude, 10)  // Set initial map view, with zoom level 10
        .setMapStyle("mapbox://styles/mapbox/streets-v12")  // Style of the map
        .setZoomRange(10,16)
        .addMarkers(
          placeList.map((place) => ({
            latitude: place.latitude,
            longitude: place.longitude,
            title: place.name,
            description: `Explore ${place.name}`,
            text: place.name,
          }))
        )
        .build()
    )
    .addChild(new ImageCardUIBuilder("https://picsum.photos/id/603/300/400")
    .aspectRatio("square")
    .title("U.S.A.")
    .build()

    )  // Add the ImageCard UI below the map
    .content(`Discover exciting activities in ${locationName} today!`)
    .build(),
};

      
    } catch (error) {
      console.error("Error fetching places or image:", error?.message || String(error));
      return {
        text: `Sorry, we couldn't fetch activities for ${locationName}. Please try again later.`,
        data: {},
        ui: new CardUIBuilder()
          .setRenderMode("page")
          .title("Error")
          .content(`There was an issue fetching the activities. Please try again later.`)
          .build(),
      };
    }
  },
};

const dainService = defineDAINService({
  metadata: {
    title: "FunRec DAIN Service",
    description: "A DAIN service for recommending Activities API",
    version: "1.0.0",
    author: "Mark and Renzo",
    tags: ["Activities", "fun", "dain"],
    logo: "https://img.icons8.com/?size=100&id=2qSx1JG5SSGn&format=png&color=000000",
  },
  exampleQueries: [
    {
      category: "Activities",
      queries: [
        "What fun activities around Carson?",
        "What fun activities around Cerritos?",
        "What fun activities around LongBeach?",
      ],
    },
  ],
  identity: {
    apiKey: process.env.DAIN_API_KEY,
  },
  tools: [getFunRec],
});

dainService.startNode({ port: 2022 }).then(({ address }) => {
  console.log("FunRec DAIN Service is running at :" + address().port);
});
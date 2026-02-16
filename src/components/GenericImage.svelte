<script lang="ts">
  interface Props {
    image: {
      url: string;
      width: number;
      height: number;
    } | null;
    altText?: string;
    classList?: string;
    loading?: "lazy" | "eager";
    sizes: string;
  }

  let {
    image,
    altText = "",
    classList = "",
    loading = "lazy",
    sizes
  }: Props = $props();

  // Values used for srcset attribute of image tag (in pixels)
  const srcSetValues = [
    50, 100, 200, 450, 600, 750, 900, 1000, 1250, 1500, 1750, 2000, 2500,
  ];

  // Generate microCMS image URL with width parameter
  function imageUrl(url: string, width: number): string {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}w=${width}`;
  }
</script>

{#if image}
  <img
    src={image.url}
    alt={altText}
    class={classList}
    width={image.width}
    height={image.height}
    {loading}
    {sizes}
    srcset={srcSetValues
      .filter((value) => image && value < image.width)
      .map((value) => {
        if (image && image.width >= value) {
          return `${imageUrl(image.url, value)} ${value}w`;
        }
      })
      .join(", ")
      .concat(`, ${image.url} ${image.width}w`)}
  />
{:else}
  <div class="bg-gray-200 aspect-square" />
{/if}

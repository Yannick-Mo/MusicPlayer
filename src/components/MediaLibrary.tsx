import { onMount, type Component } from "solid-js";
import { loadLibraryData } from "../store/libraryStore";
import LibrarySidebar from "./LibrarySidebar";
import LibraryContent from "./LibraryContent";

interface MediaLibraryProps {
  onPlay: (id: number, title: string, artist: string) => void;
}

const MediaLibrary: Component<MediaLibraryProps> = (props) => {
  onMount(() => {
    loadLibraryData();
  });

  return (
    <div class="h-full flex overflow-hidden">
      <LibrarySidebar />
      <LibraryContent onPlay={props.onPlay} />
    </div>
  );
};

export default MediaLibrary;

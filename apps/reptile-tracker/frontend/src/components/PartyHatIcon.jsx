/**
 * PartyHatIcon - Classic cone party hat SVG icon
 *
 * Adapted from party-hat-birthday-svgrepo-com.svg
 * Colors adjusted to match app's violet/fuchsia celebration theme.
 *
 * Props:
 * - className: Additional CSS classes for sizing/positioning
 * - style: Inline styles for precise positioning
 */
export default function PartyHatIcon({ className = '', style = {} }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Cone stripes - alternating violet and cream */}
      <g>
        {/* Violet stripe */}
        <path
          fill="#8b5cf6"
          d="M217.545,147.142l-46.827,90.59c42.288-17.282,87.413-44.99,124.354-89.397l-10.556-20.428c-8.538,4.422-18.239,6.921-28.517,6.921c-10.278,0-19.972-2.5-28.51-6.921L217.545,147.142z"
        />
        {/* Cream stripe */}
        <path
          fill="#f5f3ff"
          d="M295.071,148.335c-36.942,44.407-82.067,72.115-124.354,89.397l-61.614,119.184c59.116-9.132,159.956-38.21,226.257-130.643L295.071,148.335z"
        />
        {/* Violet stripe */}
        <path
          fill="#8b5cf6"
          d="M335.361,226.272c-66.301,92.431-167.143,121.51-226.257,130.643l-31.466,60.871c0,0,184.403,3.021,281.499-145.516L335.361,226.272z"
        />
        {/* Cream stripe */}
        <path
          fill="#f5f3ff"
          d="M359.137,272.27C262.04,420.807,77.637,417.786,77.637,417.786L57.758,456.24c27.816,16.055,61.726,27.847,98.484,35.331c35.248-3.83,166.632-25.27,245.735-136.424L359.137,272.27z"
        />
        {/* Violet stripe */}
        <path
          fill="#8b5cf6"
          d="M401.979,355.148c-79.104,111.154-210.488,132.594-245.735,136.423c54.549,11.124,115.364,12.759,171.805,4.796c35.55-21.159,70.918-50.947,98.926-92.866L401.979,355.148z"
        />
        {/* Cream stripe */}
        <path
          fill="#f5f3ff"
          d="M426.974,403.503c-28.008,41.919-63.376,71.706-98.926,92.866c47.19-6.642,91.327-19.997,126.192-40.127L426.974,403.503z"
        />
        {/* Pom-pom at top - purple */}
        <path
          fill="#7c3aed"
          d="M284.51,127.906c19.942-10.33,33.569-31.151,33.569-55.157c0-34.288-27.791-62.078-62.08-62.078c-34.283,0-62.078,27.791-62.078,62.078c0,24.006,13.63,44.831,33.569,55.157c3.25,1.683,6.671,3.089,10.23,4.184c5.777,1.779,11.917,2.737,18.28,2.737C266.276,134.828,275.977,132.328,284.51,127.906z"
        />
      </g>
    </svg>
  );
}
